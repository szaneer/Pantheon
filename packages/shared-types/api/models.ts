export interface LLMModel {
  id: string;
  name: string;
  displayName?: string;
  provider: string;
  deviceId: string;
  deviceName: string;
  endpoint: string;
  isRemote: boolean;
  apiSecret?: string;
  // Router-specific fields
  routerDeviceId?: string;
  isRouter?: boolean;
}