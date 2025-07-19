// Pantheon Configuration Example
// This file provides default configuration values.
// For sensitive data like API keys, use environment variables instead.
// Copy .env.example to .env and update with your values.

module.exports = {
  // Firebase Configuration
  // MUST be loaded from environment variables - see .env.example
  firebase: {
    apiKey: process.env.VITE_FIREBASE_API_KEY || "your-api-key-here",
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "your-project.firebaseapp.com",
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || "your-project-id",
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "your-project.appspot.com",
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "your-sender-id",
    appId: process.env.VITE_FIREBASE_APP_ID || "your-app-id"
  },

  // Ollama Configuration
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
    timeout: parseInt(process.env.OLLAMA_TIMEOUT) || 30000
  },

  // App Configuration
  app: {
    name: process.env.APP_NAME || "Pantheon",
    version: process.env.APP_VERSION || "1.0.0",
    debug: process.env.APP_DEBUG === "true" || false,
    logLevel: process.env.APP_LOG_LEVEL || "info"
  },

  // Device Configuration
  device: {
    autoRegister: false, // Disabled - use P2P registration only
    heartbeatInterval: parseInt(process.env.DEVICE_HEARTBEAT_INTERVAL) || 30000,
    offlineTimeout: parseInt(process.env.DEVICE_OFFLINE_TIMEOUT) || 60000,
    httpPort: parseInt(process.env.DEVICE_HTTP_PORT) || 3002,
    hostingUrl: process.env.DEVICE_HOSTING_URL // Optional, for ngrok or similar
  },

  // P2P Coordination Server Configuration
  p2p: {
    signalingServerUrl: process.env.VITE_SIGNALING_SERVER_URL || process.env.VITE_PROD_SIGNALING_SERVER_URL || "http://localhost:3001",
    autoConnect: process.env.P2P_AUTO_CONNECT !== "false",
    reconnectDelay: parseInt(process.env.P2P_RECONNECT_DELAY) || 2000,
    maxReconnectAttempts: parseInt(process.env.P2P_MAX_RECONNECT_ATTEMPTS) || 5,
    heartbeatInterval: parseInt(process.env.P2P_HEARTBEAT_INTERVAL) || 30000
  }
}; 