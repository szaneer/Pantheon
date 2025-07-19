// P2P Configuration for Web Client

export interface P2PConfig {
  signalingServerUrl: string;
  autoConnect: boolean;
  reconnectDelay: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
}

// Determine Socket.io server URL based on environment
const getSignalingServerUrl = (): string => {
  // Check localStorage first (from onboarding)
  const savedUrl = localStorage.getItem('signalingServerUrl');
  if (savedUrl) {
    return savedUrl;
  }
  
  // Check for environment variable
  if (import.meta.env.VITE_SIGNALING_SERVER_URL) {
    return import.meta.env.VITE_SIGNALING_SERVER_URL;
  }
  
  // Default to localhost
  return "http://localhost:3001";
};

// Legacy API base URL (kept for compatibility)
const getApiBaseUrl = (): string => {
  return getSignalingServerUrl();
};

export { getApiBaseUrl };

export const p2pConfig: P2PConfig = {
  signalingServerUrl: getSignalingServerUrl(),
  autoConnect: true,
  reconnectDelay: 2000,
  maxReconnectAttempts: 5,
  heartbeatInterval: 30000
};

export default p2pConfig;