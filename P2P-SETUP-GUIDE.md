# Pantheon P2P Setup Guide

This guide will help you set up the new Socket.io + Simple-peer P2P architecture for seamless model sharing between Electron hosts and Web clients.

## Architecture Overview

### Components

1. **Signaling Server** (Node.js + Socket.io)
   - Handles WebRTC signaling between peers
   - Uses Firebase for authentication
   - Manages account-based rooms

2. **Electron Host** (Model Provider)
   - Hosts local Ollama models
   - One-click hosting toggle
   - Automatic peer discovery

3. **Web Client** (Model Consumer)
   - Discovers and connects to Electron hosts
   - Uses hosted models seamlessly
   - Real-time P2P communication

## Quick Start

### 1. Start the Signaling Server

```bash
cd server
npm install
npm start
```

The server will run on `http://localhost:3001` by default.

### 2. Configure Electron App

The Electron app will automatically use the new P2P service. Users can:

1. Enable hosting with the toggle switch
2. Models are automatically shared with same-account devices
3. See connected peers and request statistics

### 3. Configure Web Client

The Web client will automatically discover and connect to Electron hosts on the same account.

## Configuration

### Environment Variables

Create `.env` file in the server directory:

```env
PORT=3001
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
CORS_ORIGINS=http://localhost:3000,http://localhost:8100
```

### Electron Configuration

Update `apps/electron/config.js`:

```javascript
module.exports = {
  p2p: {
    signalingServerUrl: 'http://localhost:3001',
    autoConnect: true,
    maxReconnectAttempts: 5,
    reconnectDelay: 2000,
    heartbeatInterval: 30000
  },
  ollama: {
    baseUrl: 'http://localhost:11434'
  }
};
```

### Web Client Configuration

Update `apps/web/src/config/p2p.ts`:

```typescript
export const p2pConfig = {
  signalingServerUrl: 'http://localhost:3001',
  autoConnect: true,
  maxReconnectAttempts: 5,
  reconnectDelay: 2000,
  heartbeatInterval: 30000
};
```

## Usage

### Electron App (Model Host)

1. **Enable Hosting**:
   ```javascript
   import p2pService from './services/p2pServiceV2';
   
   // Enable one-click hosting
   await p2pService.enableHosting();
   ```

2. **Monitor Status**:
   ```javascript
   p2pService.on('hosting', (data) => {
     console.log('Hosting status:', data);
   });
   
   p2pService.on('peer', (event) => {
     console.log('Peer event:', event);
   });
   ```

3. **UI Component**:
   ```jsx
   import { ModelHostingToggle } from './components/ModelHostingToggle';
   
   function App() {
     return (
       <div>
         <ModelHostingToggle />
       </div>
     );
   }
   ```

### Web Client (Model Consumer)

1. **Use P2P Hook**:
   ```typescript
   import { useP2PClient } from './hooks/useP2PClient';
   
   function MyComponent() {
     const {
       status,
       peers,
       allModels,
       connect,
       sendChatRequest,
       findModelHost
     } = useP2PClient(userId, authToken);
     
     // Use models from peers
     const hostUserId = findModelHost('llama2:latest');
     if (hostUserId) {
       const response = await sendChatRequest(hostUserId, {
         model: 'llama2:latest',
         messages: [{ role: 'user', content: 'Hello!' }]
       });
     }
   }
   ```

2. **UI Component**:
   ```tsx
   import { P2PModelSelector } from './components/P2PModelSelector';
   
   function ModelSelection() {
     return (
       <P2PModelSelector
         selectedModel={selectedModel}
         onModelSelect={handleModelSelect}
         userId={userId}
         authToken={authToken}
       />
     );
   }
   ```

## API Reference

### Electron P2P Service

```javascript
// Enable/disable hosting
await p2pService.enableHosting();
await p2pService.disableHosting();

// Get status
const status = p2pService.getStatus();

// Event listeners
p2pService.on('status', (data) => {});
p2pService.on('hosting', (data) => {});
p2pService.on('peer', (event) => {});
p2pService.on('request', (data) => {});
```

### Web P2P Client

```typescript
// Initialize
await p2pClientService.initialize(userId, authToken);

// Discover and connect
await p2pClientService.discoverPeers();
await p2pClientService.connectToPeer(userId);

// Request models and chat
const models = await p2pClientService.requestModelsFromPeer(userId);
const response = await p2pClientService.sendChatRequest(userId, request);

// Event listeners
p2pClientService.on('status', (status) => {});
p2pClientService.on('peer', (event) => {});
p2pClientService.on('model', (models) => {});
```

## Troubleshooting

### Common Issues

1. **Connection Failed**:
   - Check signaling server is running on port 3001
   - Verify Firebase credentials are correct
   - Check CORS settings for web client

2. **Models Not Appearing**:
   - Ensure Ollama is running on Electron host
   - Check hosting is enabled in Electron app
   - Verify peers are connected

3. **WebRTC Connection Issues**:
   - Check firewall settings
   - Ensure STUN servers are accessible
   - Consider adding TURN servers for NAT traversal

### Debug Mode

Enable detailed logging:

```javascript
// Electron
localStorage.setItem('debug', 'p2p:*');

// Web
localStorage.setItem('debug', 'p2p:*');
```

### Network Requirements

- **Ports**: 3001 (signaling server)
- **Protocols**: WebSocket, WebRTC
- **STUN**: stun.l.google.com:19302
- **Firewall**: Allow WebRTC traffic

## Production Deployment

### Signaling Server

```bash
# Install dependencies
cd server
npm install --production

# Set environment variables
export PORT=3001
export FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
export CORS_ORIGINS=https://your-domain.com

# Start with PM2
pm2 start server.js --name pantheon-signaling
```

### Docker Deployment

```bash
# Build and run with Docker
cd server
docker build -t pantheon-signaling .
docker run -p 3001:3001 -e FIREBASE_DATABASE_URL=... pantheon-signaling
```

### Load Balancing

For multiple server instances, use sticky sessions:

```nginx
upstream signaling {
    ip_hash;
    server server1:3001;
    server server2:3001;
}

server {
    location / {
        proxy_pass http://signaling;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## Security Considerations

1. **Authentication**: All connections require Firebase JWT tokens
2. **Account Isolation**: Peers can only connect within same account
3. **CORS**: Configure appropriate origins for web clients
4. **Rate Limiting**: Built into signaling server
5. **Encryption**: WebRTC provides end-to-end encryption

## Performance Tips

1. **Model Caching**: Models are cached for 30 seconds
2. **Connection Reuse**: Peer connections are persistent
3. **Batch Requests**: Use batch operations when possible
4. **Memory Management**: Connections are cleaned up automatically

## Migration from Legacy System

The new system is designed to be backward compatible. To migrate:

1. Start the new signaling server
2. Update Electron app to use `p2pServiceV2`
3. Update Web client to use `p2pClientServiceV2`
4. Gradually phase out old WebSocket implementation

Legacy endpoints remain functional during transition period.