/**
 * Test script to verify Twilio Network Traversal Service token response
 * Run with: node test-twilio-token.js
 */

require('dotenv').config();
const twilio = require('twilio');

async function testTwilioToken() {
    try {
        // Check if Twilio credentials are configured
        if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
            console.error('❌ Twilio credentials not configured in .env file');
            console.log('Please add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to your .env file');
            return;
        }

        console.log('🔧 Testing Twilio Network Traversal Service...');
        console.log('Account SID:', process.env.TWILIO_ACCOUNT_SID.substring(0, 10) + '...');
        
        // Create Twilio client
        const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        
        // Create token with 1 hour TTL
        console.log('\n📡 Requesting TURN token...');
        const turnToken = await twilioClient.tokens.create({
            ttl: 3600 // 1 hour TTL
        });
        
        // Log the full response to understand its structure
        console.log('\n✅ Token created successfully!');
        console.log('\n📋 Full response:');
        console.log(JSON.stringify(turnToken, null, 2));
        
        // Check specific fields
        console.log('\n🔍 Response analysis:');
        console.log('- Has ice_servers:', !!turnToken.ice_servers);
        console.log('- Has iceServers:', !!turnToken.iceServers);
        console.log('- Has username:', !!turnToken.username);
        console.log('- Has password:', !!turnToken.password);
        console.log('- Has ttl:', !!turnToken.ttl);
        console.log('- Response type:', typeof turnToken);
        console.log('- Response keys:', Object.keys(turnToken));
        
        // If ice_servers exist, show their structure
        if (turnToken.ice_servers) {
            console.log('\n🧊 ICE Servers:');
            console.log(JSON.stringify(turnToken.ice_servers, null, 2));
        } else if (turnToken.iceServers) {
            console.log('\n🧊 ICE Servers (camelCase):');
            console.log(JSON.stringify(turnToken.iceServers, null, 2));
        }
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        if (error.code) {
            console.error('Error code:', error.code);
        }
        if (error.moreInfo) {
            console.error('More info:', error.moreInfo);
        }
    }
}

// Run the test
testTwilioToken();