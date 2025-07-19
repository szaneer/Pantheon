// Pantheon Configuration Example
// Copy this file to config.js and update with your values

module.exports = {
  // Firebase Configuration
  firebase: {
    apiKey: "your-api-key-here",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "your-sender-id",
    appId: "your-app-id"
  },

  // Ollama Configuration
  ollama: {
    baseUrl: "http://127.0.0.1:11434",
    timeout: 30000
  },

  // App Configuration
  app: {
    name: "Pantheon",
    version: "1.0.0",
    debug: false,
    logLevel: "info"
  },

  // Device Configuration
  device: {
    autoRegister: true,
    heartbeatInterval: 30000, // 30 seconds
    offlineTimeout: 60000 // 1 minute
  }
}; 