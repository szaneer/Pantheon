export interface ElectronAPI {
  // Device management
  getDeviceId: () => Promise<string>;
  getStoreValue: (key: string) => Promise<any>;
  setStoreValue: (key: string, value: any) => Promise<boolean>;
  getPlatform: () => Promise<string>;
  
  // Window management
  isWindowVisible: () => Promise<boolean>;
  showWindow: () => Promise<boolean>;
  hideWindow: () => Promise<boolean>;
  
  // Navigation
  onNavigateTo: (callback: (event: any, path: string) => void) => void;
  removeNavigateTo: () => void;
  
  // Network interface detection
  getNetworkInterfaces: () => Promise<{ [key: string]: any[] } | null>;
  
  // Battery state
  getBatteryState: () => Promise<any>;
  
  // P2P coordination service
  p2p: {
    getStatus: () => Promise<any>;
    connect: () => Promise<boolean>;
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
  
  // Additional P2P methods
  p2pGetStatus: () => Promise<any>;
  p2pGetPeers: () => Promise<any[]>;
  p2pOnStatus: (callback: (event: any, status: any) => void) => void;
  p2pOnPeers: (callback: (event: any, peers: any[]) => void) => void;
  p2pRemoveStatus: () => void;
  p2pRemovePeers: () => void;
  
  // Apple models
  appleModels: {
    isSupported: () => Promise<boolean>;
    initialize: () => Promise<{ success: boolean; error?: string }>;
    getModels: () => Promise<{ success: boolean; models?: any[]; error?: string }>;
    chat: (request: any) => Promise<{ success: boolean; response?: any; error?: string }>;
    getSystemRequirements: () => Promise<any>;
  };
  
  // HTTP server
  httpServer: {
    getStatus: () => Promise<any>;
    getPort: () => Promise<number>;
    getActiveClients: () => Promise<any[]>;
    addStatusListener: () => Promise<boolean>;
    onStatusChanged: (callback: (event: any, status: any) => void) => void;
    removeStatusChanged: () => void;
  };
  
  // Ollama
  ollama: {
    start: () => Promise<boolean>;
    stop: () => Promise<boolean>;
    isRunning: () => Promise<boolean>;
    listModels: () => Promise<any[]>;
    pullModel: (modelName: string) => Promise<boolean>;
    deleteModel: (modelName: string) => Promise<boolean>;
    getModelInfo: (modelName: string) => Promise<any>;
    onDownloadProgress: (callback: (event: any, progress: any) => void) => void;
    onPullProgress: (callback: (event: any, progress: any) => void) => void;
    removeDownloadProgress: () => void;
    removePullProgress: () => void;
  };
  
  // Logging
  logging: {
    getLogs: (level?: string | null, limit?: number) => Promise<any[]>;
    getLogFile: () => Promise<string>;
    getLogsDirectory: () => Promise<string>;
    clearLogs: () => Promise<boolean>;
    setLevel: (level: string) => Promise<boolean>;
    openLogsFolder: () => Promise<boolean>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};