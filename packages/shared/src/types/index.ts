// Shared types for Pantheon project

export interface ModelInfo {
  name: string;
  provider: string;
  size?: number;
  modified?: string;
}

export interface PeerInfo {
  userId: string;
  socketId: string;
  deviceInfo?: any;
  connectedAt?: string;
  models?: ModelInfo[];
  batteryState?: BatteryState;
  clientType?: 'web' | 'electron' | 'mobile';
}

export interface BatteryState {
  isCharging: boolean;
  percentage: number | null;
  isOnBatteryPower: boolean;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface ChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface Device {
  id: string;
  name: string;
  isOnline: boolean;
  models: string[];
  endpoint?: string;
  apiSecret?: string;
  lastSeen?: string;
}

export interface P2PMessage {
  type: string;
  requestId?: string;
  data?: any;
  error?: string;
}

export interface SignalData {
  type?: 'offer' | 'answer';
  sdp?: string;
  candidate?: RTCIceCandidate;
}