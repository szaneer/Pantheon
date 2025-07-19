/**
 * Service for fetching Twilio TURN tokens for reliable NAT traversal
 */

const config = require('../../config.js');
const twilioTurnService = require('./twilioTurnService.js');

class TurnService {
  constructor() {
    this.turnToken = null;
    this.tokenExpiry = 0;
    this.fetchPromise = null;
  }

  /**
   * Get TURN servers configuration
   * Always fetches from signaling server - no local fallbacks
   */
  async getTurnServers(authToken) {
    // Check if we have a valid cached token from signaling server
    if (this.turnToken && Date.now() < this.tokenExpiry) {
      console.log('✅ Using cached TURN servers');
      console.log('🔍 Cached servers:', JSON.stringify(this.turnToken.ice_servers?.slice(0, 3), null, 2));
      return this.turnToken.ice_servers;
    }

    // If already fetching, wait for the existing promise
    if (this.fetchPromise) {
      console.log('⏳ Waiting for existing TURN fetch...');
      const token = await this.fetchPromise;
      return token.ice_servers;
    }

    // Must have auth token to get TURN servers
    if (!authToken) {
      throw new Error('Authentication required to get TURN servers');
    }

    console.log('🔄 Fetching fresh TURN credentials from signaling server...');
    this.fetchPromise = this.fetchTurnToken(authToken);
    
    try {
      const token = await this.fetchPromise;
      this.turnToken = token;
      // Set expiry to 80% of TTL for safety
      this.tokenExpiry = Date.now() + ((token.ttl || 3600) * 800);
      console.log('✅ Got TURN servers from signaling server');
      console.log('🔍 Fetched servers:', JSON.stringify(token.ice_servers?.slice(0, 3), null, 2));
      
      if (!token.ice_servers || token.ice_servers.length === 0) {
        throw new Error('No TURN servers returned from signaling server');
      }
      
      return token.ice_servers;
    } catch (error) {
      console.error('❌ Failed to fetch TURN servers:', error.message);
      console.error('📡 URL attempted:', config.p2p?.signalingServerUrl || 'http://localhost:3001');
      throw error;
    } finally {
      this.fetchPromise = null;
    }
  }

  /**
   * Fetch TURN token from server
   */
  async fetchTurnToken(authToken) {
    if (!authToken) {
      throw new Error('Auth token required for TURN token');
    }

    const axios = require('axios');
    const signalingServerUrl = config.p2p?.signalingServerUrl || 'http://localhost:3001';
    
    try {
      // Try the correct endpoint without /api prefix
      console.log(`📡 Fetching TURN token from: ${signalingServerUrl}/turn-token`);
      const response = await axios.post(`${signalingServerUrl}/turn-token`, {}, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true' // For ngrok compatibility
        },
        timeout: 10000 // 10 second timeout for slow connections
      });

      if (response.status !== 200) {
        throw new Error(`Failed to fetch TURN token: ${response.status}`);
      }

      const data = response.data;
      console.log('📡 TURN token response:', JSON.stringify(data, null, 2));
      
      
      // Handle case where Twilio returns credentials without ice_servers array
      if (!data.ice_servers && data.username && data.password) {
      console.log('🔧 Constructing ice_servers from Twilio credentials');
      console.log('🔑 Twilio username:', data.username || 'Not provided - will generate');
      
      // If no username/password provided, the signaling server should generate them
      const twilioUsername = data.username;
      const twilioPassword = data.password || data.credential;
      
      if (!twilioUsername || !twilioPassword) {
        console.warn('⚠️ Twilio credentials not provided by server');
        throw new Error('Invalid Twilio credentials from server');
      }
      
      data.ice_servers = [
        { urls: 'stun:global.stun.twilio.com:3478' },
        {
          urls: ['turn:global.turn.twilio.com:3478?transport=udp'],
          username: twilioUsername,
          credential: twilioPassword
        },
        {
          urls: ['turn:global.turn.twilio.com:3478?transport=tcp'],
          username: twilioUsername,
          credential: twilioPassword
        },
        {
          urls: ['turn:global.turn.twilio.com:443?transport=tcp'],
          username: twilioUsername,
          credential: twilioPassword
        },
        {
          urls: ['turns:global.turn.twilio.com:443?transport=tcp'],
          username: twilioUsername,
          credential: twilioPassword
        }
      ];
    }
    
    return data;
    } catch (error) {
      console.warn('⚠️ Failed to fetch Twilio TURN token:', error.message);
      throw error;
    }
  }



  /**
   * Clear cached token (useful on sign out)
   */
  clearCache() {
    if (process.env.NODE_ENV !== 'production') {
      console.log('🗑️ Clearing TURN cache');
    }
    this.turnToken = null;
    this.tokenExpiry = 0;
    this.fetchPromise = null;
  }
  
  /**
   * Force refresh TURN credentials
   */
  async forceRefresh(authToken) {
    this.clearCache();
    return this.getTurnServers(authToken);
  }
}

// Export singleton instance
module.exports = new TurnService();