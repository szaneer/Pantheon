/**
 * Direct Twilio TURN service for fetching credentials
 */

const axios = require('axios');

class TwilioTurnService {
  constructor() {
    this.credentials = null;
    this.credentialsExpiry = 0;
  }

  async getTwilioTurnServers() {
    // Check cache
    if (this.credentials && Date.now() < this.credentialsExpiry) {
      return this.credentials;
    }

    const accountSid = process.env.VITE_TWILIO_ACCOUNT_SID;
    const authToken = process.env.VITE_TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      console.warn('⚠️ Twilio credentials not configured');
      return null;
    }

    try {
      console.log('🔑 Fetching Twilio TURN credentials directly...');
      
      // Create a Network Traversal Service Token
      const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
      
      const response = await axios.post(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Tokens.json`,
        '',
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 5000
        }
      );

      if (response.status === 201 && response.data) {
        const data = response.data;
        console.log('✅ Got Twilio TURN token');
        
        // Twilio returns ice_servers array
        const iceServers = data.ice_servers || [];
        
        // Cache for 80% of TTL (usually 24 hours)
        this.credentials = iceServers;
        this.credentialsExpiry = Date.now() + (data.ttl * 800);
        
        return iceServers;
      }
    } catch (error) {
      console.error('❌ Failed to fetch Twilio TURN credentials:', error.message);
      if (error.response) {
        console.error('Response:', error.response.status, error.response.data);
      }
    }

    return null;
  }
}

module.exports = new TwilioTurnService();