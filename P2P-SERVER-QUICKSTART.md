# Pantheon P2P Server - Quick Start Guide

## 🚀 One-Command Setup

Run this from your Pantheon project root directory:

```bash
./setup-server.sh
```

**✅ Current Status: Build Fixed!**  
The server now builds successfully. The setup script will handle dependencies and configuration.

This will automatically:
- ✅ Install Go, Docker, Redis, and other dependencies
- ✅ Build the P2P coordination server
- ✅ Configure environment variables
- ✅ Set up deployment scripts
- ✅ Create launch scripts for your platform

## 📋 What You Need Before Starting

1. **Firebase Project**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project or use existing one
   - Enable Authentication (Email/Password)
   - Download service account key (will be prompted during setup)

2. **System Requirements**
   - macOS or Linux
   - Internet connection
   - Admin/sudo access (for some installations)

## 🔧 Manual Setup (if needed)

If the automatic setup doesn't work, you can run individual steps:

```bash
# Navigate to server directory
cd server

# Install dependencies only
./setup.sh verify

# Setup Firebase only
./setup.sh firebase

# Build server only
./setup.sh build
```

## 🏃‍♂️ Running the Server

### Option 1: Local Development
```bash
cd server
./start-server.sh  # macOS
# OR
sudo systemctl start pantheon-server  # Linux
```

### Option 2: Docker Deployment
```bash
cd server
./scripts/deploy.sh deploy
```

## 🧪 Testing the Setup

1. **Check server health:**
   ```bash
   curl http://localhost:8080/health
   ```

2. **View server logs:**
   ```bash
   # Docker deployment
   cd server && docker-compose logs -f
   
   # Local deployment (Linux)
   sudo journalctl -u pantheon-server -f
   
   # Local deployment (macOS)
   # Check console output
   ```

## 🔗 Integration with Pantheon

After setup, update your Electron app:

1. **WebSocket Connection:**
   ```javascript
   const COORDINATION_SERVER = 'ws://localhost:8080/ws';
   ```

2. **Firebase Config:**
   - Use the same Firebase project as the server
   - Enable Authentication in your client app

3. **P2P Client Integration:**
   ```javascript
   // Example client usage
   import { P2PClient } from './server/pkg/p2p';
   
   const client = new P2PClient({
     firebaseToken: await user.getIdToken(),
     coordinatorURL: 'ws://localhost:8080/ws',
     accountId: user.uid,
     peerID: generatePeerID()
   });
   
   await client.connect();
   ```

## 🛠 Configuration Files

After setup, you'll have these key files:

- `server/.env` - Environment configuration
- `server/secrets/firebase-key.json` - Firebase service account key
- `server/docker-compose.yml` - Docker deployment config
- `server/README.md` - Detailed documentation

## 🔍 Troubleshooting

### Common Issues:

1. **Go not installed:**
   ```bash
   # The setup script will install Go automatically
   # Or install manually: https://golang.org/doc/install
   ```

2. **Docker not running:**
   ```bash
   # Start Docker Desktop (macOS)
   # Or: sudo systemctl start docker (Linux)
   ```

3. **Firebase authentication errors:**
   - Verify `secrets/firebase-key.json` exists
   - Check `FIREBASE_PROJECT_ID` in `.env`
   - Ensure Firebase Authentication is enabled

4. **Port 8080 already in use:**
   ```bash
   # Change PORT in server/.env file
   # Or stop conflicting service
   ```

### Getting Help:

1. **Verify installation:**
   ```bash
   ./setup-server.sh verify
   ```

2. **Check server status:**
   ```bash
   cd server && ./scripts/deploy.sh status
   ```

3. **View logs:**
   ```bash
   cd server && ./scripts/deploy.sh logs
   ```

## 📚 Next Steps

1. **Read the documentation:**
   - `server/README.md` - Complete server documentation
   - `server/pkg/p2p/client.go` - Client SDK examples

2. **Integrate with your Pantheon app:**
   - Replace direct HTTP calls with P2P connections
   - Add peer discovery to your device service
   - Enable real-time communication between devices

3. **Deploy to production:**
   - Configure domain and SSL certificates
   - Set up load balancing for multiple server instances
   - Configure monitoring and logging

## 🏆 Success!

Once setup is complete, you'll have a fully functional P2P coordination server that enables secure, real-time communication between Pantheon instances across different devices and networks.

Your Pantheon can now:
- ✅ Discover peers across different networks
- ✅ Establish secure P2P connections
- ✅ Share models and resources between devices
- ✅ Communicate in real-time with WebRTC
- ✅ Scale to multiple users and accounts