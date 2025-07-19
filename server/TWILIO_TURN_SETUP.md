# Twilio TURN Server Integration

This document explains how to set up and use Twilio's Network Traversal Service for TURN/STUN servers in the Pantheon signaling server.

## Overview

Twilio's Network Traversal Service provides TURN and STUN servers that help establish peer-to-peer connections when devices are behind NATs or firewalls. The service generates short-lived credentials to ensure security.

## Setup

### 1. Get Twilio Credentials

1. Sign up for a Twilio account at https://www.twilio.com
2. Navigate to your Account Dashboard
3. Find your Account SID and Auth Token
4. Enable Network Traversal Service in your Twilio console

### 2. Configure Environment Variables

Add the following to your `.env` file:

```env
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
```

### 3. Test the Integration

Run the test script to verify your Twilio setup:

```bash
node test-twilio-token.js
```

This will show you the exact response format from Twilio's API.

## API Endpoint

The server exposes a `/turn-token` endpoint that requires Firebase authentication:

```bash
POST /turn-token
Authorization: Bearer <firebase-id-token>
```

### Response Format

```json
{
  "ice_servers": [
    {
      "urls": "stun:global.stun.twilio.com:3478"
    },
    {
      "urls": "turn:global.turn.twilio.com:3478?transport=udp",
      "username": "generated_username",
      "credential": "generated_password"
    },
    {
      "urls": "turn:global.turn.twilio.com:3478?transport=tcp",
      "username": "generated_username",
      "credential": "generated_password"
    },
    {
      "urls": "turn:global.turn.twilio.com:443?transport=tcp",
      "username": "generated_username",
      "credential": "generated_password"
    }
  ],
  "ttl": 3600
}
```

## Implementation Details

### Server-Side (server.js)

The server handles two possible response formats from Twilio:

1. **Modern SDK Format**: Response includes `ice_servers` or `iceServers` array
2. **Legacy Format**: Response only includes `username` and `password`

The implementation automatically detects the format and constructs the ice_servers array if needed.

### Client-Side (turnService.ts)

The client-side service:
- Caches tokens to reduce API calls
- Automatically refreshes expired tokens
- Falls back to public TURN servers if Twilio is unavailable
- Normalizes server formats for WebRTC compatibility

## Troubleshooting

### Common Issues

1. **No ice_servers in response**
   - Check Twilio SDK version (should be 5.x or higher)
   - Verify Network Traversal Service is enabled in Twilio console
   - Run the test script to see the actual response format

2. **Authentication errors**
   - Verify TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are correct
   - Ensure the credentials are not expired or revoked

3. **Connection failures**
   - Check that all TURN server URLs are included (UDP, TCP, and TLS)
   - Verify firewall rules allow outbound connections to Twilio servers
   - Test with the fallback servers to isolate Twilio-specific issues

### Debug Mode

To enable detailed logging:

1. Server-side: The server logs the Twilio response when constructing ice_servers
2. Client-side: The turnService logs the raw response and normalized servers

## Security Notes

- TURN credentials are short-lived (default 1 hour)
- Always verify Firebase authentication before generating tokens
- Never expose Twilio credentials to the client
- Use HTTPS in production to protect token transmission

## Fallback Servers

If Twilio is not configured or fails, the system falls back to public TURN servers:
- Google STUN servers
- OpenRelay TURN servers (public, less reliable)

For production use, always configure Twilio or another reliable TURN service.