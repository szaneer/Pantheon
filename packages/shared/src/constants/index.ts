// Shared constants

export const P2P_MESSAGE_TYPES = {
  GET_MODELS: 'get_models',
  MODELS_AVAILABLE: 'models_available',
  CHAT: 'chat',
  PING: 'ping',
  PONG: 'pong',
  ERROR: 'error',
  RESPONSE: 'response'
} as const;

export const CONNECTION_STATES = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  ERROR: 'error'
} as const;

export const CLIENT_TYPES = {
  WEB: 'web',
  ELECTRON: 'electron',
  MOBILE: 'mobile'
} as const;

export const TIMEOUTS = {
  CONNECTION: 15000, // 15 seconds
  REQUEST: 30000, // 30 seconds
  KEEP_ALIVE: 5000, // 5 seconds
  MODEL_ANNOUNCE_DELAY: 1000, // 1 second
  RECONNECT_DELAY: 2000 // 2 seconds
} as const;

export const MODEL_PROVIDERS = {
  OLLAMA: 'Ollama',
  APPLE_FOUNDATION: 'Apple Foundation Models',
  REMOTE: 'Remote',
  P2P: 'P2P'
} as const;