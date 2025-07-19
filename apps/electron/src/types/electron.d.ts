export interface ElectronAPI {
  getDeviceId: () => string;
  getStoreValue: (key: string) => any;
  setStoreValue: (key: string, value: any) => boolean;
  getPlatform: () => string;
  isWindowVisible: () => Promise<boolean>;
  showWindow: () => Promise<boolean>;
  hideWindow: () => Promise<boolean>;
  onNavigateTo: (callback: (event: any, path: string) => void) => void;
  removeNavigateTo: () => void;
  getNetworkInterfaces: () => Promise<any>;
  appleModels?: {
    isSupported: () => Promise<boolean>;
    initialize: () => Promise<{ success: boolean; error?: string }>;
    getModels: () => Promise<{ success: boolean; models?: any[]; error?: string }>;
    chat: (request: any) => Promise<{ success: boolean; response?: any; error?: string }>;
    getSystemRequirements: () => Promise<any>;
  };
  p2p: {
    getStatus: () => Promise<any>;
    connect: () => Promise<any>;
    disconnect: () => Promise<boolean>;
    setCurrentUserId: (userId: string, authToken?: string) => Promise<boolean>;
    setAuthToken: (token: string) => Promise<boolean>;
    enableHosting: () => Promise<boolean>;
    disableHosting: () => Promise<boolean>;
    addStatusListener: () => Promise<boolean>;
    addHostingListener: () => Promise<boolean>;
    addPeerListener: () => Promise<boolean>;
    onStatusChanged: (callback: (event: any, status: any) => void) => void;
    onHostingChanged: (callback: (event: any, hostingData: any) => void) => void;
    onPeerChanged: (callback: (event: any, peerData: any) => void) => void;
    removeStatusChanged: () => void;
    removeHostingChanged: () => void;
    removePeerChanged: () => void;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}