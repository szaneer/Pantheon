/**
 * P2P Client Service for Web Client
 * Connects to P2P coordination server for peer discovery and communication
 * Web clients are consumers only - they don't host LLM services
 */

import { p2pConfig, getApiBaseUrl } from '../config/p2p';

export interface PeerInfo {
  peer_id: string;
  account_id: string;
  platform: string;
  capabilities: string[];
  last_seen: string;
}

export interface P2PStatus {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  connected: boolean;
  peerId?: string;
  error?: string;
  serverUrl: string;
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

type StatusListener = (status: P2PStatus) => void;
type PeerListListener = (peers: PeerInfo[]) => void;

class P2PClientService {
  private ws: WebSocket | null = null;
  private connected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = p2pConfig.maxReconnectAttempts;
  private reconnectDelay = p2pConfig.reconnectDelay;
  private heartbeatInterval: number | null = null;
  private listeners = new Set<StatusListener>();
  private peerListListeners = new Set<PeerListListener>();
  private lastPeerList: PeerInfo[] = [];
  private currentUserId: string | null = null;
  private peerId: string | null = null;
  private status: P2PStatus['status'] = 'disconnected';
  private lastError: string | null = null;
  private authToken: string | null = null;
  private modelDiscoveryInProgress = false;

  /**
   * Set current authenticated user ID and auth token
   */
  setCurrentUserId(userId: string, authToken?: string) {
    this.currentUserId = userId;
    this.authToken = authToken || null;
    console.log('🔧 P2PClientService: Set current user ID to', userId);
    console.log('🔑 P2PClientService: Auth token available:', !!this.authToken);
    if (this.authToken) {
      console.log('🔑 P2PClientService: Token preview:', this.authToken.substring(0, 20) + '...');
    }
    
    // Auto-connect if enabled and not already connected
    if (p2pConfig.autoConnect && !this.connected) {
      console.log('🌐 User authenticated, connecting to P2P server...');
      this.connect().catch(error => {
        console.error('❌ Failed to connect to P2P server after authentication:', error);
      });
    }
  }

  /**
   * Connect to the P2P coordination server
   */
  async connect(): Promise<void> {
    if (this.connected || this.ws) {
      console.log('P2P client already connected or connecting');
      return;
    }

    if (!this.currentUserId) {
      throw new Error('User not authenticated - please log in to connect to P2P server');
    }

    this.setStatus('connecting', 'Connecting to P2P coordination server...');

    try {
      console.log('🔌 Connecting to P2P coordination server:', p2pConfig.serverUrl);
      
      this.ws = new WebSocket(p2pConfig.serverUrl);
      
      this.ws.onopen = () => {
        console.log('✅ Connected to P2P coordination server');
        this.connected = true;
        this.reconnectAttempts = 0;
        this.setStatus('connected', 'Connected to P2P server');
        
        // Authenticate as client (not host)
        this.authenticate();
      };

      this.ws.onmessage = (event) => {
        try {
          console.log('📨 Raw WebSocket message received:', event.data);
          const message = JSON.parse(event.data);
          console.log('📨 Parsed WebSocket message:', message);
          this.handleMessage(message);
        } catch (error) {
          console.error('❌ Failed to parse P2P message:', error);
          console.error('❌ Raw message data:', event.data);
          console.error('❌ Error details:', error instanceof Error ? error.message : error);
        }
      };

      this.ws.onclose = (event) => {
        console.log(`🔌 P2P connection closed: ${event.code} - ${event.reason}`);
        console.log('📊 Model discovery in progress:', this.modelDiscoveryInProgress);
        
        if (event.code === 1009) {
          console.error('❌ WebSocket closed due to message too big. This usually means the auth token is too large.');
          console.error('💡 Check the console for "📊 Auth message size" to see the actual message size');
        }
        
        // Don't cleanup immediately if model discovery is in progress
        if (!this.modelDiscoveryInProgress) {
          this.cleanup();
        } else {
          console.log('⏳ Delaying cleanup due to model discovery in progress...');
          setTimeout(() => {
            if (!this.modelDiscoveryInProgress) {
              this.cleanup();
            }
          }, 5000);
        }
        
        // Attempt reconnection if not intentional and not during model discovery
        if (event.code !== 1000 && !this.modelDiscoveryInProgress) { // 1000 = normal closure
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ P2P WebSocket error:', error);
        this.setStatus('error', 'Connection error');
        this.cleanup();
        this.scheduleReconnect();
      };

    } catch (error) {
      console.error('❌ Failed to connect to P2P server:', error);
      this.setStatus('error', `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Authenticate with the coordination server as a client
   */
  private async authenticate() {
    if (!this.ws || !this.connected) {
      throw new Error('Not connected to P2P server');
    }

    try {
      const peerId = this.generatePeerId();
      
      // Use Firebase token if available, otherwise fallback to development token
      let token = this.authToken;
      
      if (!token) {
        // Use development token with user ID for proper account mapping
        token = this.currentUserId ? `dev:${this.currentUserId}` : 'dev-token';
        console.log('🔑 Using development token for authentication (no Firebase token available)');
      } else {
        console.log('🔐 Using Firebase token for authentication');
        console.log('🔑 Token length:', this.authToken.length, 'characters');
      }
      console.log('📝 Current user ID:', this.currentUserId);
      
      const authData = {
        type: 'auth',
        token: token,
        peer_id: peerId
      };

      // Check message size - server now supports up to 1MB but we'll be conservative
      const authDataStr = JSON.stringify(authData);
      console.log('📊 Auth message size:', authDataStr.length, 'bytes');
      
      if (authDataStr.length > 64000) { // 64KB limit to be safe
        console.warn('⚠️ Auth message is very large, using fallback token');
        // Use shorter fallback token
        const fallbackToken = this.currentUserId ? `dev:${this.currentUserId}` : 'dev-token';
        const fallbackAuthData = {
          type: 'auth',
          token: fallbackToken,
          peer_id: peerId
        };
        console.log('📊 Fallback auth message size:', JSON.stringify(fallbackAuthData).length, 'bytes');
        console.log('🔐 Authenticating as P2P client with fallback token...');
        this.ws.send(JSON.stringify(fallbackAuthData));
      } else {
        console.log('🔐 Authenticating as P2P client...');
        this.ws.send(authDataStr);
      }
      
    } catch (error) {
      console.error('❌ Failed to authenticate:', error);
      this.setStatus('error', `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Generate a unique peer ID for this client session
   */
  private generatePeerId(): string {
    return 'web-client-' + Date.now() + '-' + Math.random().toString(36).substring(2, 11);
  }

  /**
   * Handle incoming messages from the coordination server
   */
  private handleMessage(message: any) {
    console.log('📨 Received P2P message:', message.type);

    switch (message.type) {
      case 'auth_response':
        this.handleAuthResponse(message);
        break;
      
      case 'peer_list':
        this.handlePeerList(message);
        break;
      
      case 'chat_response':
        this.handleChatResponse(message);
        break;
      
      case 'models_response':
        if (this.handlePeerModelsResponse) {
          this.handlePeerModelsResponse(message);
        }
        break;
      
      case 'error':
        console.error('❌ P2P server error:', message.error);
        this.setStatus('error', `Server error: ${message.error}`);
        break;
      
      default:
        console.log('🤷 Unknown P2P message type:', message.type);
    }
  }

  /**
   * Handle authentication response
   */
  private handleAuthResponse(message: any) {
    if (message.success) {
      this.peerId = message.peer_id;
      
      console.log('✅ Authentication successful as client:', {
        account_id: message.account_id,
        peer_id: this.peerId
      });
      
      this.setStatus('connected', `Connected as client ${this.peerId}`);
      
      // Start heartbeat after successful authentication
      this.startHeartbeat();
      
    } else {
      console.error('❌ Authentication failed:', message.error);
      this.setStatus('error', `Authentication failed: ${message.error}`);
    }
  }

  /**
   * Handle peer list response
   */
  private handlePeerList(message: any) {
    console.log('📋 Received peer list:', message.peers);
    const peers = message.peers || [];
    
    // Store the peer list
    this.lastPeerList = peers;
    
    // Notify peer list listeners
    this.peerListListeners.forEach(listener => {
      try {
        listener(peers);
      } catch (error) {
        console.error('Error in peer list listener:', error);
      }
    });
  }

  /**
   * Handle chat response from a host peer
   */
  private handleChatResponse(message: any) {
    console.log('💬 Received chat response:', message);
    // This will be handled by the chat service
  }

  /**
   * Get list of available peers (host devices) using REST API
   */
  async getPeers(): Promise<PeerInfo[]> {
    if (!this.currentUserId) {
      throw new Error('User not authenticated - please log in to see P2P devices');
    }
    
    if (!this.authToken) {
      console.warn('⚠️ No Firebase auth token available - using development mode for P2P peer discovery');
    }

    // Clear cached peer list to force fresh fetch
    this.lastPeerList = [];

    try {
      // Use REST API to get peers for the current user
      const serverUrl = getApiBaseUrl();
      const url = `${serverUrl}/api/v1/peers/${this.currentUserId}?t=${Date.now()}`;
      // Use Firebase token if available, otherwise use development token
      const token = this.authToken || `dev:${this.currentUserId}`;
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };
      
      console.log('🌐 Making REST API request to:', url);
      console.log('🔑 Request headers:', { ...headers, Authorization: `Bearer ${token.length > 20 ? token.substring(0, 20) + '...' : token}` });
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...headers,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ REST API failed: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`Failed to fetch peers: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      const peers = data.peers || [];
      
      console.log('📋 Fetched peers from REST API:', peers);
      console.log('🔍 Peer details:', peers.map((p: PeerInfo) => ({ 
        peer_id: p.peer_id, 
        platform: p.platform, 
        capabilities: p.capabilities,
        last_seen: p.last_seen 
      })));
      return peers;
      
    } catch (error) {
      console.error('❌ Failed to fetch peers via REST API:', error);
      
      // Fallback to WebSocket method (keeping for compatibility)
      return this.getPeersViaWebSocket();
    }
  }

  /**
   * Fallback method to get peers via WebSocket (original implementation)
   */
  private async getPeersViaWebSocket(): Promise<PeerInfo[]> {
    if (!this.ws || !this.connected) {
      throw new Error('Not connected to P2P server');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for peer list'));
      }, 10000);

      // Set up one-time listener for response
      const handleResponse = (peers: PeerInfo[]) => {
        clearTimeout(timeout);
        this.peerListListeners.delete(handleResponse);
        resolve(peers);
      };

      this.peerListListeners.add(handleResponse);

      // Send request for peer list
      this.ws!.send(JSON.stringify({
        type: 'get_peers'
      }));
    });
  }

  /**
   * Add peer list change listener
   */
  addPeerListListener(listener: PeerListListener): () => void {
    this.peerListListeners.add(listener);
    
    // Immediately call with current peer list
    listener(this.lastPeerList);
    
    return () => this.peerListListeners.delete(listener);
  }

  /**
   * Get cached peer list
   */
  getCachedPeers(): PeerInfo[] {
    return this.lastPeerList;
  }

  /**
   * Request available models from a specific peer with retry logic
   */
  async requestPeerModels(peerId: string): Promise<string[]> {
    if (!this.ws || !this.connected) {
      throw new Error('Not connected to P2P server');
    }
    
    console.log('📋 Requesting models from peer:', peerId);
    console.log('🔗 Current connection status:', this.getStatus());

    return new Promise((resolve, reject) => {
      const requestId = Date.now().toString();
      
      // Mark model discovery as in progress to prevent disconnection
      this.modelDiscoveryInProgress = true;
      
      const timeout = setTimeout(() => {
        this.modelDiscoveryInProgress = false;
        console.error(`⏰ Model request timeout after 30 seconds for peer: ${peerId} (attempt ${retryCount + 1})`);
        console.error('🔍 Connection status at timeout:', this.getStatus());
        
        reject(new Error('Timeout waiting for models response'));
      }, 30000); // 30 seconds timeout

      // Send models request to specific peer
      const request = {
        type: 'peer_request',
        to_peer_id: peerId,
        request_id: requestId,
        data: {
          type: 'get_models'
        }
      };
      
      console.log('📤 Sending models request:', request);
      this.ws!.send(JSON.stringify(request));

      // Set up one-time listener for response
      const originalHandler = this.handlePeerModelsResponse?.bind(this) || (() => {});
      this.handlePeerModelsResponse = (message: any) => {
        console.log('📥 Received models response:', message);
        if (message.request_id === requestId) {
          clearTimeout(timeout);
          this.modelDiscoveryInProgress = false;
          this.handlePeerModelsResponse = originalHandler;
          
          if (message.success) {
            console.log('✅ Models received successfully:', message.data?.models);
            console.log('📝 Message data structure:', JSON.stringify(message.data, null, 2));
            
            const models = message.data?.models || [];
            if (!Array.isArray(models)) {
              console.error('❌ Models data is not an array:', typeof models, models);
              this.modelDiscoveryInProgress = false;
              reject(new Error('Invalid models data received: not an array'));
              return;
            }
            
            resolve(models);
          } else {
            console.error('❌ Models request failed:', message.error);
            this.modelDiscoveryInProgress = false;
            reject(new Error(message.error || 'Failed to get models'));
          }
        } else {
          console.log('🤷 Models response with different request_id:', message.request_id, 'expected:', requestId);
        }
      };
    });
  }

  /**
   * Handle models response from a peer
   */
  private handlePeerModelsResponse?(message: any): void;

  /**
   * Send chat request to a specific peer
   */
  async sendChatRequest(peerId: string, request: ChatRequest): Promise<ChatResponse> {
    if (!this.ws || !this.connected) {
      throw new Error('Not connected to P2P server');
    }

    return new Promise((resolve, reject) => {
      const requestId = Date.now().toString();
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for chat response'));
      }, 30000);

      // Send chat request to specific peer
      this.ws!.send(JSON.stringify({
        type: 'peer_request',
        to_peer_id: peerId,
        request_id: requestId,
        data: request
      }));

      // Set up one-time listener for response
      const originalHandler = this.handleChatResponse.bind(this);
      this.handleChatResponse = (message: any) => {
        if (message.request_id === requestId) {
          clearTimeout(timeout);
          this.handleChatResponse = originalHandler;
          
          if (message.success) {
            resolve(message.data);
          } else {
            reject(new Error(message.error || 'Chat request failed'));
          }
        }
      };
    });
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = window.setInterval(() => {
      if (this.ws && this.connected) {
        this.ws.send(JSON.stringify({
          type: 'heartbeat',
          timestamp: Date.now()
        }));
      }
    }, p2pConfig.heartbeatInterval);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      this.setStatus('error', 'Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts; // Exponential backoff
    
    console.log(`⏱️ Scheduling reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      if (!this.connected) {
        console.log('🔄 Attempting to reconnect to P2P server...');
        this.connect().catch(error => {
          console.error('❌ Reconnection failed:', error);
        });
      }
    }, delay);
  }

  /**
   * Clean up connection resources
   */
  private cleanup() {
    this.connected = false;
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws = null;
    }
  }

  /**
   * Disconnect from P2P server
   */
  disconnect() {
    console.log('🔌 Disconnecting from P2P server...');
    this.setStatus('disconnected', 'Disconnected from P2P server');
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
    }
    
    this.cleanup();
    this.reconnectAttempts = 0;
  }

  /**
   * Set status and notify listeners
   */
  private setStatus(status: P2PStatus['status'], message?: string) {
    this.status = status;
    if (message) {
      this.lastError = status === 'error' ? message : null;
      console.log(`P2P client status: ${status} - ${message}`);
    }
    
    const statusObj: P2PStatus = {
      status: this.status,
      connected: this.connected,
      peerId: this.peerId || undefined,
      error: this.lastError || undefined,
      serverUrl: p2pConfig.serverUrl
    };
    
    // Notify listeners
    this.listeners.forEach(listener => {
      try {
        listener(statusObj);
      } catch (error) {
        console.error('Error in P2P status listener:', error);
      }
    });
  }

  /**
   * Add status change listener
   */
  addStatusListener(listener: StatusListener): () => void {
    this.listeners.add(listener);
    
    // Immediately call with current status
    const statusObj: P2PStatus = {
      status: this.status,
      connected: this.connected,
      peerId: this.peerId || undefined,
      error: this.lastError || undefined,
      serverUrl: p2pConfig.serverUrl
    };
    listener(statusObj);
    
    return () => this.listeners.delete(listener);
  }

  /**
   * Get current status
   */
  getStatus(): P2PStatus {
    return {
      status: this.status,
      connected: this.connected,
      peerId: this.peerId || undefined,
      error: this.lastError || undefined,
      serverUrl: p2pConfig.serverUrl
    };
  }

  /**
   * Initialize P2P client service
   */
  async initialize() {
    console.log('Initializing P2PClientService...');
    
    if (p2pConfig.autoConnect && this.currentUserId) {
      console.log('🌐 User already authenticated, connecting to P2P server...');
      await this.connect();
    } else {
      console.log('🌐 P2P client service initialized, waiting for user authentication...');
    }
  }

  /**
   * Shutdown P2P client service
   */
  async shutdown() {
    console.log('Shutting down P2PClientService...');
    this.disconnect();
  }
}

// Export singleton instance
export const p2pClientService = new P2PClientService();
export default p2pClientService;