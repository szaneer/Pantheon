import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from the root .env file
const rootPath = path.resolve(__dirname, '../../../');
dotenv.config({ path: path.join(rootPath, '.env') });

// Firebase configuration (safe for client-side)
export const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || '',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.VITE_FIREBASE_APP_ID || ''
};

// Server configuration (server-side only)
export const serverConfig = {
  port: parseInt(process.env.SERVER_PORT || '3001'),
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['*'],
  firebaseDatabaseUrl: process.env.FIREBASE_DATABASE_URL || '',
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || ''
  },
  turn: {
    secret: process.env.TURN_SECRET || '',
    domain: process.env.COORDINATION_DOMAIN || 'localhost'
  }
};

// P2P configuration
export const p2pConfig = {
  signalingServerUrl: process.env.NODE_ENV === 'production' 
    ? process.env.VITE_PROD_SIGNALING_SERVER_URL || ''
    : process.env.SIGNALING_SERVER_URL || 'http://localhost:3001',
  autoConnect: true,
  reconnectDelay: 2000,
  maxReconnectAttempts: 5,
  heartbeatInterval: 30000
};

// Ollama configuration
export const ollamaConfig = {
  baseUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
  timeout: parseInt(process.env.OLLAMA_TIMEOUT || '30000')
};

// App configuration
export const appConfig = {
  name: process.env.APP_NAME || 'Pantheon',
  version: process.env.APP_VERSION || '1.0.0',
  debug: process.env.APP_DEBUG === 'true',
  logLevel: process.env.APP_LOG_LEVEL || 'info',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development'
};

// Device configuration
export const deviceConfig = {
  autoRegister: process.env.DEVICE_AUTO_REGISTER !== 'false',
  heartbeatInterval: parseInt(process.env.DEVICE_HEARTBEAT_INTERVAL || '30000'),
  offlineTimeout: parseInt(process.env.DEVICE_OFFLINE_TIMEOUT || '60000')
};

// Export a function to get the signaling server URL dynamically
export function getSignalingServerUrl(): string {
  if (typeof window !== 'undefined') {
    // Browser environment
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
      return process.env.SIGNALING_SERVER_URL || 'http://localhost:3001';
    }
  }
  return process.env.VITE_PROD_SIGNALING_SERVER_URL || p2pConfig.signalingServerUrl;
}

// Validate required configuration
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check Firebase config
  if (!firebaseConfig.apiKey) errors.push('Firebase API key is missing');
  if (!firebaseConfig.authDomain) errors.push('Firebase auth domain is missing');
  if (!firebaseConfig.projectId) errors.push('Firebase project ID is missing');
  
  // Check server config (only if running on server)
  if (typeof window === 'undefined') {
    if (serverConfig.twilio.accountSid && !serverConfig.twilio.authToken) {
      errors.push('Twilio auth token is missing');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export default {
  firebase: firebaseConfig,
  server: serverConfig,
  p2p: p2pConfig,
  ollama: ollamaConfig,
  app: appConfig,
  device: deviceConfig,
  getSignalingServerUrl,
  validateConfig
};