// Shared types and interfaces for Pantheon
export * from './api/chat';
export * from './api/models';
export * from './api/chat-state';

// Window type extensions
export interface PantheonWindow extends Window {
  electronAPI?: {
    getDevices: () => Promise<any[]>;
    registerDevice: (device: any) => Promise<any>;
    updateDevice: (device: any) => Promise<any>;
    removeDevice: (deviceId: string) => Promise<void>;
    startHTTPServer: (port: number) => Promise<void>;
    stopHTTPServer: () => Promise<void>;
    getLocalModels: () => Promise<any[]>;
    chat: (model: string, messages: any[]) => Promise<any>;
    openExternal: (url: string) => Promise<void>;
    showMessageBox: (options: any) => Promise<any>;
    showSaveDialog: (options: any) => Promise<any>;
    writeFile: (path: string, content: string) => Promise<void>;
    showItemInFolder: (path: string) => void;
  };
}

declare global {
  interface Window extends PantheonWindow {}
}