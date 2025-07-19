export interface LLMModel {
  id: string;
  name: string;
  provider: string;
  deviceId: string;
  deviceName: string;
  endpoint: string;
  isRemote: boolean;
  isP2P?: boolean;
  peerId?: string;
}