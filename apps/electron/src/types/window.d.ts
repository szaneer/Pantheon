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
  getNetworkInterfaces?: () => Promise<{ [key: string]: any[] } | null>;
  
  // Pantheon Router integration
  router?: {
    getStatus: () => Promise<any>;
    registerDevice: () => Promise<boolean>;
    unregisterDevice: () => Promise<boolean>;
    updateDomain: (newDomain: string) => Promise<boolean>;
    addStatusListener: () => Promise<boolean>;
    sendHeartbeat: () => Promise<boolean>;
    checkHealth: () => Promise<boolean>;
    setCurrentUserId: (userId: string | null) => Promise<boolean>;
    onStatusChanged: (callback: (event: any, status: any) => void) => void;
    removeStatusChanged: () => void;
  };
  
  // P2P Coordination Service integration
  p2p?: {
    getStatus: () => Promise<any>;
    connect: () => Promise<boolean>;
    disconnect: () => Promise<boolean>;
    setCurrentUserId: (userId: string | null) => Promise<boolean>;
    setAuthToken: (token: string) => Promise<boolean>;
    addStatusListener: () => Promise<boolean>;
    onStatusChanged: (callback: (event: any, status: any) => void) => void;
    removeStatusChanged: () => void;
  };
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};