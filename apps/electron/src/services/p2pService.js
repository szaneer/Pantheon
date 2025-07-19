/**
 * P2P Service for connecting to the coordination server
 * Handles device registration and peer-to-peer communication
 */

const WebSocket = require('ws');
const config = require('../../config.js');

class P2PService {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.deviceId = null;
    this.peerId = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = config.p2p.maxReconnectAttempts;
    this.reconnectDelay = config.p2p.reconnectDelay;
    this.heartbeatInterval = null;
    this.listeners = new Set();
    this.currentUserId = null;
    this.deviceInfo = null;
    this.status = 'disconnected'; // disconnected, connecting, connected, error
    this.lastError = null;
  }

  // Firebase registration removed - using P2P only

  /**
   * Set current authenticated user ID and auth token
   */
  setCurrentUserId(userId, authToken = null) {
    this.currentUserId = userId;
    this.authToken = authToken;
    console.log('🔧 P2PService: Set current user ID to', userId);
    
    // Auto-connect if enabled and not already connected
    if (config.p2p.autoConnect && !this.connected) {
      console.log('🌐 User authenticated, connecting to P2P server...');
      this.connect().catch(error => {
        console.error('❌ Failed to connect to P2P server after authentication:', error);
      });
    }
  }

  /**
   * Set Firebase authentication token
   */
  setAuthToken(token) {
    this.authToken = token;
    console.log('🔑 P2PService: Set auth token');
    console.log('🔑 Token preview:', token ? token.substring(0, 20) + '...' : 'null');
    
    // If already connected, reconnect with the new token
    if (this.connected && this.currentUserId) {
      console.log('🔄 Reconnecting with new auth token...');
      this.disconnect();
      setTimeout(() => {
        this.connect().catch(error => {
          console.error('❌ Failed to reconnect with new auth token:', error);
        });
      }, 1000);
    }
  }

  /**
   * Connect to the P2P coordination server
   */
  async connect() {
    if (this.connected || this.ws) {
      console.log('P2P service already connected or connecting');
      return;
    }

    if (!this.currentUserId) {
      throw new Error('User not authenticated - please log in to connect to P2P server');
    }

    this.setStatus('connecting', 'Connecting to P2P coordination server...');

    try {
      console.log('🔌 Connecting to P2P coordination server:', config.p2p.serverUrl);
      
      // For local development, connect without authentication
      // TODO: Add proper Firebase JWT authentication for production
      this.ws = new WebSocket(config.p2p.serverUrl);
      
      this.ws.on('open', () => {
        console.log('✅ Connected to P2P coordination server');
        this.connected = true;
        this.reconnectAttempts = 0;
        this.setStatus('connected', 'Connected to P2P server');
        
        // Authenticate first, then register
        this.authenticate();
      });

      this.ws.on('message', (data) => {
        try {
          const messageStr = data.toString();
          console.log('📨 Raw WebSocket message received (length:', messageStr.length, '):', messageStr.substring(0, 200) + (messageStr.length > 200 ? '...' : ''));
          
          // Try simple JSON parse first
          try {
            const message = JSON.parse(messageStr);
            console.log('📨 Parsed message (simple):', message);
            this.handleMessage(message);
          } catch (simpleError) {
            console.log('⚠️ Simple JSON parse failed, trying multiple message parsing...');
            
            // Handle potential multiple JSON messages in one frame
            const messages = this.parseMultipleJsonMessages(messageStr);
            
            for (const message of messages) {
              if (message) {
                console.log('📨 Parsed message (multi):', message);
                this.handleMessage(message);
              }
            }
          }
        } catch (error) {
          console.error('❌ Failed to parse P2P message:', error);
          console.error('❌ Raw message data:', data.toString());
          console.error('❌ Message length:', data.toString().length);
        }
      });

      this.ws.on('close', (code, reason) => {
        console.log(`🔌 P2P connection closed: ${code} - ${reason}`);
        this.cleanup();
        
        // Attempt reconnection if not intentional
        if (code !== 1000) { // 1000 = normal closure
          this.scheduleReconnect();
        }
      });

      this.ws.on('error', (error) => {
        console.error('❌ P2P WebSocket error:', error);
        this.setStatus('error', `Connection error: ${error.message}`);
        this.cleanup();
        this.scheduleReconnect();
      });

    } catch (error) {
      console.error('❌ Failed to connect to P2P server:', error);
      this.setStatus('error', `Connection failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Authenticate with the coordination server
   */
  async authenticate() {
    if (!this.ws || !this.connected) {
      throw new Error('Not connected to P2P server');
    }

    try {
      const deviceId = await this.getDeviceId();
      const token = await this.getAuthToken();
      
      // Use a development token that includes the user ID to ensure proper account mapping
      const fallbackToken = this.currentUserId ? `dev:${this.currentUserId}` : 'dev-token';
      
      const authData = {
        type: 'auth',
        token: token || fallbackToken,
        peer_id: deviceId
      };

      // Check message size - server now supports up to 1MB but we'll be conservative
      const authDataStr = JSON.stringify(authData);
      console.log('📊 Auth message size:', authDataStr.length, 'bytes');
      
      if (authDataStr.length > 64000) { // 64KB limit to be safe
        console.warn('⚠️ Auth message is very large, using fallback token');
        // Use shorter fallback token
        const fallbackAuthData = {
          type: 'auth',
          token: fallbackToken,
          peer_id: deviceId
        };
        console.log('📊 Fallback auth message size:', JSON.stringify(fallbackAuthData).length, 'bytes');
        console.log('🔐 Authenticating with P2P server (fallback token)...');
        this.ws.send(JSON.stringify(fallbackAuthData));
      } else {
        console.log('🔐 Authenticating with P2P server...');
        this.ws.send(authDataStr);
      }
      
    } catch (error) {
      console.error('❌ Failed to authenticate:', error);
      this.setStatus('error', `Authentication failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Register this device as a peer with the coordination server
   */
  async registerPeer() {
    if (!this.ws || !this.connected) {
      throw new Error('Not connected to P2P server');
    }

    try {
      // Get device info
      const models = await this.getAvailableModels();
      
      const registrationData = {
        type: 'register',
        platform: process.platform,
        public_ip: '', // Will be detected by server
        local_ips: [], // TODO: Get local IPs
        nat_type: 'unknown',
        endpoint: '', // WebSocket-only mode
        capabilities: ['chat', 'streaming'],
        // Explicitly include user ID to ensure proper account mapping
        user_id: this.currentUserId || 'dev-user'
      };

      console.log('📝 Registering peer with P2P server:', {
        platform: registrationData.platform,
        capabilities: registrationData.capabilities,
        user_id: registrationData.user_id
      });

      this.ws.send(JSON.stringify(registrationData));
      
    } catch (error) {
      console.error('❌ Failed to register peer:', error);
      this.setStatus('error', `Registration failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Parse potentially multiple JSON messages from a single WebSocket frame
   */
  parseMultipleJsonMessages(messageStr) {
    const messages = [];
    let remaining = messageStr.trim();
    
    while (remaining.length > 0) {
      try {
        // Try to parse a complete JSON message
        const message = JSON.parse(remaining);
        messages.push(message);
        break; // If we get here, the entire string was valid JSON
      } catch (error) {
        // Look for the end of the first complete JSON object
        let braceCount = 0;
        let inString = false;
        let escaped = false;
        let endIndex = -1;
        
        for (let i = 0; i < remaining.length; i++) {
          const char = remaining[i];
          
          if (escaped) {
            escaped = false;
            continue;
          }
          
          if (char === '\\') {
            escaped = true;
            continue;
          }
          
          if (char === '"') {
            inString = !inString;
            continue;
          }
          
          if (!inString) {
            if (char === '{') {
              braceCount++;
            } else if (char === '}') {
              braceCount--;
              if (braceCount === 0) {
                endIndex = i + 1;
                break;
              }
            }
          }
        }
        
        if (endIndex > 0) {
          const singleMessage = remaining.substring(0, endIndex);
          try {
            const message = JSON.parse(singleMessage);
            messages.push(message);
            remaining = remaining.substring(endIndex).trim();
          } catch (parseError) {
            console.error('❌ Failed to parse single message:', singleMessage);
            break;
          }
        } else {
          console.error('❌ Could not find complete JSON in:', remaining);
          break;
        }
      }
    }
    
    return messages;
  }

  /**
   * Handle incoming messages from the coordination server
   */
  handleMessage(message) {
    console.log('📨 Received P2P message:', message.type);

    switch (message.type) {
      case 'auth_response':
        this.handleAuthResponse(message);
        break;
      
      case 'registered':
        this.handleRegisterResponse(message);
        break;
      
      case 'peer_request':
        this.handlePeerRequest(message);
        break;
      
      case 'offer':
      case 'answer':
      case 'ice_candidate':
        this.handleWebRTCMessage(message);
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
  handleAuthResponse(message) {
    if (message.success) {
      this.peerId = message.peer_id;
      
      console.log('✅ Authentication successful:', {
        account_id: message.account_id,
        peer_id: this.peerId
      });
      
      // Now register as peer
      this.registerPeer();
      
    } else {
      console.error('❌ Authentication failed:', message.error);
      this.setStatus('error', `Authentication failed: ${message.error}`);
    }
  }

  /**
   * Handle registration response
   */
  async handleRegisterResponse(message) {
    this.peerId = message.peer_id;
    
    console.log('✅ Peer registration successful:', {
      peer_id: this.peerId
    });
    
    this.setStatus('connected', `Registered as peer ${this.peerId}`);
    
    // P2P registration complete - no Firebase registration needed
    // Web clients will discover this device via P2P coordination server
    console.log('✅ P2P device hosting enabled - skipping Firebase registration');
    
    // Start heartbeat after successful registration
    this.startHeartbeat();
  }

  /**
   * Handle incoming peer requests (chat requests and model requests from other clients)
   */
  async handlePeerRequest(message) {
    console.log('📩 Received peer request from peer:', message.from_peer_id, 'type:', message.data?.type || 'chat');
    
    try {
      let response;
      let responseType = 'peer_response';
      
      // Check if this is a models request
      if (message.data && message.data.type === 'get_models') {
        console.log('📋 Processing models list request...');
        const models = await this.getAvailableModels();
        response = { models };
        responseType = 'models_response';
        console.log('✅ Returning models:', models);
      } else {
        // Default to chat request
        console.log('🤖 Processing chat request...');
        response = await this.processChatRequest(message.data);
      }
      
      // Send response back through coordination server
      this.ws.send(JSON.stringify({
        type: responseType,
        to_peer_id: message.from_peer_id,
        request_id: message.request_id,
        success: true,
        data: response
      }));
      
    } catch (error) {
      console.error('❌ Error processing peer request:', error);
      
      // Send error response
      this.ws.send(JSON.stringify({
        type: 'peer_response',
        to_peer_id: message.from_peer_id,
        request_id: message.request_id,
        success: false,
        error: error.message
      }));
    }
  }

  /**
   * Handle WebRTC signaling messages
   */
  handleWebRTCMessage(message) {
    console.log('🔗 Received WebRTC message:', message.type);
    // TODO: Implement WebRTC handling for direct peer connections
  }

  /**
   * Process chat request using local Ollama
   */
  async processChatRequest(requestData) {
    try {
      // Lazy load node-fetch
      const { default: fetch } = await import('node-fetch');
      
      const ollamaUrl = config.ollama.baseUrl;
      console.log(`🤖 Processing chat request for model: ${requestData.model}`);
      
      const response = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: requestData.model,
          messages: requestData.messages,
          stream: false,
          options: {
            temperature: requestData.temperature || 0.7,
            max_tokens: requestData.max_tokens || 2048
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Convert Ollama response to standard format
      return {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: requestData.model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: result.message?.content || 'No response from model'
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: result.prompt_eval_count || 0,
          completion_tokens: result.eval_count || 0,
          total_tokens: (result.prompt_eval_count || 0) + (result.eval_count || 0)
        }
      };
      
    } catch (error) {
      console.error('❌ Error processing chat request:', error);
      throw error;
    }
  }

  /**
   * Get available models from Ollama
   */
  async getAvailableModels() {
    try {
      const { default: fetch } = await import('node-fetch');
      const ollamaUrl = config.ollama.baseUrl;
      
      const response = await fetch(`${ollamaUrl}/api/tags`, {
        timeout: 5000
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.models?.map(model => model.name) || [];
      }
    } catch (error) {
      console.log('Could not detect Ollama models:', error.message);
    }
    
    // Return default models if detection fails
    return ['llama2:latest', 'codellama:latest'];
  }

  /**
   * Get Firebase auth token
   */
  async getAuthToken() {
    // Use stored Firebase auth token if available
    if (this.authToken) {
      console.log('🔑 Using Firebase auth token, length:', this.authToken.length);
      return this.authToken;
    }
    
    // Fallback for when no token is available
    console.log('⚠️ No Firebase auth token available - using development token');
    return this.currentUserId ? `dev:${this.currentUserId}` : 'dev-token';
  }

  /**
   * Get device ID
   */
  async getDeviceId() {
    if (this.deviceId) {
      return this.deviceId;
    }
    
    // Try to get device ID from electron store
    if (typeof window !== 'undefined' && window.electronAPI) {
      this.deviceId = await window.electronAPI.getDeviceId();
    } else {
      // Fallback device ID generation
      const crypto = require('crypto');
      this.deviceId = crypto.randomBytes(16).toString('hex');
    }
    
    return this.deviceId;
  }

  /**
   * Get device name
   */
  getDeviceName() {
    const hostName = require('os').hostname();
    const platform = process.platform;
    return `Pantheon-${hostName}-${platform}`;
  }

  /**
   * Start heartbeat to keep connection alive
   */
  startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.connected) {
        this.ws.send(JSON.stringify({
          type: 'heartbeat',
          timestamp: Date.now()
        }));
      }
    }, config.p2p.heartbeatInterval);
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
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
  cleanup() {
    this.connected = false;
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.removeAllListeners();
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
  setStatus(status, message = null) {
    this.status = status;
    if (message) {
      this.lastError = status === 'error' ? message : null;
      console.log(`P2P status: ${status} - ${message}`);
    }
    
    // Notify listeners
    this.listeners.forEach(listener => {
      try {
        listener({
          status: this.status,
          message,
          peerId: this.peerId,
          deviceInfo: this.deviceInfo,
          error: this.lastError
        });
      } catch (error) {
        console.error('Error in P2P status listener:', error);
      }
    });
  }

  /**
   * Add status change listener
   */
  addStatusListener(listener) {
    this.listeners.add(listener);
    
    // Immediately call with current status
    listener({
      status: this.status,
      message: this.lastError,
      peerId: this.peerId,
      deviceInfo: this.deviceInfo,
      error: this.lastError
    });
    
    return () => this.listeners.delete(listener);
  }

  // Firebase registration removed - using P2P coordination server only

  /**
   * Get current status
   */
  getStatus() {
    return {
      status: this.status,
      connected: this.connected,
      peerId: this.peerId,
      deviceInfo: this.deviceInfo,
      error: this.lastError,
      serverUrl: config.p2p.serverUrl
    };
  }

  /**
   * Initialize P2P service
   */
  async initialize() {
    console.log('Initializing P2PService...');
    
    if (config.p2p.autoConnect && this.currentUserId) {
      console.log('🌐 User already authenticated, connecting to P2P server...');
      await this.connect();
    } else {
      console.log('🌐 P2P service initialized, waiting for user authentication...');
    }
  }

  /**
   * Shutdown P2P service
   */
  async shutdown() {
    console.log('Shutting down P2PService...');
    this.disconnect();
  }
}

module.exports = new P2PService();