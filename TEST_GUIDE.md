# Pantheon P2P Testing Guide

This guide explains how to test the P2P communication between Electron and Web clients using the signaling server.

## Quick Start

Run all components with a single command:

```bash
./test-local.sh
```

This will:
1. Start the signaling server on port 3001
2. Start the Electron app
3. Start the Web client on port 5173

## Manual Testing Steps

### 1. Start the Signaling Server

```bash
cd server
npm install
npm start
```

The server will run on http://localhost:3001

### 2. Start the Electron App

In a new terminal:
```bash
cd apps/electron
npm install
npm run dev
```

### 3. Start the Web Client

In another terminal:
```bash
cd apps/web
npm install
npm run dev
```

The web client will be available at http://localhost:5173

## Testing P2P Communication

1. **Login**: Use the same Firebase account in both Electron and Web apps
2. **Enable Hosting**: In the Electron app, toggle "Host Models" in the top right
3. **Connect**: The Web app should automatically discover the Electron client
4. **Select Model**: In the Web app, choose a remote model from the dropdown
5. **Chat**: Send messages - they'll be processed by the Electron app's Ollama instance

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Electron App   │────▶│ Signaling Server │◀────│   Web Client    │
│  (Model Host)   │     │  (Socket.io)     │     │ (Model Consumer)│
└────────┬────────┘     └──────────────────┘     └────────┬────────┘
         │                                                   │
         │              WebRTC P2P Connection               │
         └──────────────────────────────────────────────────┘
```

## Troubleshooting

### Server won't start
- Check if port 3001 is already in use: `lsof -i :3001`
- Ensure Firebase credentials are in `server/secrets/firebase-key.json`

### Clients can't connect
- Check CORS settings in server `.env` file
- Ensure all apps use the same Firebase project
- Check browser console for WebSocket errors

### P2P connection fails
- Ensure both clients are logged in with accounts from the same Firebase project
- Check that Ollama is running on the Electron host
- Look for WebRTC errors in browser/Electron console

### Models not showing
- Verify Ollama is running: `curl http://localhost:11434/api/tags`
- Check that model hosting is enabled in Electron app
- Wait a few seconds for peer discovery

## Docker Deployment

To test with Docker:

```bash
cd server
docker-compose up
```

This starts both the signaling server and a TURN server for NAT traversal.

## Logs

- Server logs: Check terminal or `docker logs` if using Docker
- Electron logs: DevTools console (View → Toggle Developer Tools)
- Web logs: Browser DevTools console (F12)

## Environment Variables

### Server (.env)
```
PORT=3001
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,file://
```

### Clients
Both clients use config files:
- Electron: `apps/electron/config.js`
- Web: `apps/web/src/config/p2p.ts`