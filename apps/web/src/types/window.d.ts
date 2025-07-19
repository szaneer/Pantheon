// Web client window type definitions
// Note: electronAPI is not available in web context, so we make it optional

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
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};