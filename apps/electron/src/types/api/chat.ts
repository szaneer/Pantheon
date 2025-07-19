export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  modelId?: string;
}

export interface ChatResponse {
  message: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  pantheonRouted?: boolean;
  deviceId?: string;
  deviceName?: string;
}

export interface PantheonRequest {
  type: string;
  target: DeviceTarget;
  payload: ChatPayload;
  security: SecurityConfig;
}

export interface DeviceTarget {
  deviceId: string;
  deviceName: string;
  endpoint: string;
}

export interface ChatPayload {
  modelId: string;
  messages: ChatMessage[];
  userId: string | null;
  timestamp: number;
}

export interface SecurityConfig {
  apiSecret: string;
  encrypted: boolean;
  authenticated: boolean;
}