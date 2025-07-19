# Pantheon Signaling Server

WebRTC signaling server for Pantheon P2P network coordination.

## Features

- WebSocket-based signaling for WebRTC connections
- Optional authentication via environment key
- TURN server token generation (Twilio integration)
- Health check endpoint
- Docker support

## Quick Start

```bash
# Install dependencies
npm install

# Run locally
npm start
```

## Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d
```

## Environment Variables

- `PORT` - Server port (default: 3001)
- `AUTH_KEY` - Optional authentication key for clients
- `CORS_ORIGINS` - Allowed CORS origins (default: *)
- `TWILIO_ACCOUNT_SID` - Twilio account SID for TURN servers
- `TWILIO_AUTH_TOKEN` - Twilio auth token

## API Endpoints

- `GET /health` - Health check endpoint
- `POST /turn-token` - Get TURN server credentials (requires auth if AUTH_KEY is set)
- WebSocket on `/` - P2P signaling connection

## WebSocket Events

### Client -> Server
- `join-account` - Join the global P2P network
- `webrtc-signal` - Send WebRTC signaling data to a peer
- `announce-models` - Announce available models (for hosts)

### Server -> Client  
- `peer-joined` - New peer joined the network
- `peer-left` - Peer left the network
- `webrtc-signal` - Receive WebRTC signaling data
- `existing-peers` - List of current peers

## Authentication

If `AUTH_KEY` environment variable is set, clients must provide it:
- WebSocket: Pass in auth.authKey during connection
- HTTP endpoints: Use Bearer token in Authorization header