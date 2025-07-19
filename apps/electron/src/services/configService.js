/**
 * Dynamic configuration service that reads from electron store
 */

let store = null;

// Try to load electron-store if we're in the main process
try {
  const Store = require('electron-store');
  store = new Store();
} catch (e) {
  // We're in renderer process, will use IPC
}

async function getSignalingServerUrl() {
  // First check environment variable
  if (process.env.VITE_SIGNALING_SERVER_URL) {
    return process.env.VITE_SIGNALING_SERVER_URL;
  }
  
  // Then check electron store
  if (store) {
    // Main process
    return store.get('signalingServerUrl') || 'http://localhost:3001';
  } else if (window?.electronAPI?.getStoreValue) {
    // Renderer process
    return await window.electronAPI.getStoreValue('signalingServerUrl') || 'http://localhost:3001';
  }
  
  // Fallback
  return 'http://localhost:3001';
}

async function getConfig() {
  const signalingServerUrl = await getSignalingServerUrl();
  
  return {
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
      autoRegister: false,
      heartbeatInterval: parseInt(process.env.DEVICE_HEARTBEAT_INTERVAL) || 30000,
      offlineTimeout: parseInt(process.env.DEVICE_OFFLINE_TIMEOUT) || 60000,
      httpPort: parseInt(process.env.DEVICE_HTTP_PORT) || 3002,
      hostingUrl: process.env.DEVICE_HOSTING_URL
    },

    // P2P Coordination Server Configuration
    p2p: {
      signalingServerUrl,
      autoConnect: process.env.P2P_AUTO_CONNECT !== "false",
      reconnectDelay: parseInt(process.env.P2P_RECONNECT_DELAY) || 2000,
      maxReconnectAttempts: parseInt(process.env.P2P_MAX_RECONNECT_ATTEMPTS) || 5,
      heartbeatInterval: parseInt(process.env.P2P_HEARTBEAT_INTERVAL) || 30000
    }
  };
}

module.exports = {
  getConfig,
  getSignalingServerUrl
};