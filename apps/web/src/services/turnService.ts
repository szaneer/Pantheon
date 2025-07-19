/**
 * Service for fetching Twilio TURN tokens for reliable NAT traversal
 */

const getApiBaseUrl = () => {
  return localStorage.getItem('signalingServerUrl') || 'http://localhost:3001';
};

export interface TurnTokenResponse {
  ice_servers: RTCIceServer[];
  ttl: number;
  username?: string;
  password?: string;
}

class TurnService {
  private turnToken: TurnTokenResponse | null = null;
  private tokenExpiry: number = 0;
  private fetchPromise: Promise<TurnTokenResponse> | null = null;

  /**
   * Get TURN servers configuration
   * Always fetches from signaling server - no local fallbacks
   */
  async getTurnServers(): Promise<RTCIceServer[]> {
    // Check if we have a valid cached token
    if (this.turnToken && Date.now() < this.tokenExpiry) {
      console.log('🔑 Using cached TURN servers');
      return this.normalizeIceServers(this.turnToken.ice_servers);
    }

    // If already fetching, wait for the existing promise
    if (this.fetchPromise) {
      const token = await this.fetchPromise;
      return this.normalizeIceServers(token.ice_servers);
    }

    // Fetch new token
    this.fetchPromise = this.fetchTurnToken();
    
    try {
      const token = await this.fetchPromise;
      this.turnToken = token;
      // Set expiry to 80% of TTL for safety
      this.tokenExpiry = Date.now() + (token.ttl * 800);
      
      if (!token.ice_servers || token.ice_servers.length === 0) {
        throw new Error('No TURN servers returned from signaling server');
      }
      
      return this.normalizeIceServers(token.ice_servers);
    } catch (error) {
      console.error('Failed to fetch TURN servers:', error);
      throw error;
    } finally {
      this.fetchPromise = null;
    }
  }

  /**
   * Normalize ICE servers to ensure compatibility with SimplePeer/WebRTC
   */
  private normalizeIceServers(servers: any): RTCIceServer[] {
    console.log('🔍 Raw ICE servers from response:', JSON.stringify(servers, null, 2));
    
    if (!servers) {
      throw new Error('No ICE servers in response');
    }
    
    // Handle case where servers might be the raw response object
    let serverArray = servers;
    if (!Array.isArray(servers)) {
      // Check if it's wrapped in an object
      if (servers.ice_servers && Array.isArray(servers.ice_servers)) {
        serverArray = servers.ice_servers;
      } else {
        throw new Error('Invalid ICE servers format');
      }
    }

    return serverArray.map((server: any) => {
      const normalized: RTCIceServer = {};
      
      // Handle urls/url field - SimplePeer expects 'urls'
      if (server.urls) {
        normalized.urls = server.urls;
      } else if (server.url) {
        normalized.urls = server.url;
      } else if (server.uri) {
        normalized.urls = server.uri;
      }
      
      // Handle credentials - some servers return these in different fields
      if (server.username) {
        normalized.username = server.username;
      }
      if (server.credential) {
        normalized.credential = server.credential;
      } else if (server.password) {
        normalized.credential = server.password;
      }
      
      // Handle credentialType if present
      if (server.credentialType) {
        normalized.credentialType = server.credentialType;
      }
      
      return normalized;
    });
  }

  /**
   * Fetch TURN token from server
   */
  private async fetchTurnToken(): Promise<TurnTokenResponse> {
    const authKey = localStorage.getItem('authKey');
    const apiUrl = getApiBaseUrl();
    
    const headers: any = {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true' // For ngrok compatibility
    };
    
    // Add auth key to headers if available
    if (authKey) {
      headers['Authorization'] = `Bearer ${authKey}`;
    }
    
    const response = await fetch(`${apiUrl}/turn-token`, {
      method: 'POST',
      headers
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch TURN token: ${response.status}`);
    }

    const data = await response.json();
    console.log('📡 TURN token response:', JSON.stringify(data, null, 2));
    
    // Handle case where Twilio returns credentials without ice_servers array
    if (!data.ice_servers && data.username && data.password) {
      console.log('🔧 Constructing ice_servers from Twilio credentials');
      data.ice_servers = [
        { urls: 'stun:global.stun.twilio.com:3478' },
        {
          urls: 'turn:global.turn.twilio.com:3478?transport=udp',
          username: data.username,
          credential: data.password
        },
        {
          urls: 'turn:global.turn.twilio.com:3478?transport=tcp',
          username: data.username,
          credential: data.password
        },
        {
          urls: 'turn:global.turn.twilio.com:443?transport=tcp',
          username: data.username,
          credential: data.password
        }
      ];
    }
    
    return data;
  }


  /**
   * Clear cached token (useful on sign out)
   */
  clearCache() {
    this.turnToken = null;
    this.tokenExpiry = 0;
    this.fetchPromise = null;
  }
}

// Export singleton instance
export const turnService = new TurnService();