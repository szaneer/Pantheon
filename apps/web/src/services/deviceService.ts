// Minimal device service for P2P-only architecture
// Legacy Firebase registration has been removed

export interface Device {
  id: string;
  name: string;
  userId: string;
  endpoint: string;
  isOnline: boolean;
  lastSeen: Date;
  models: string[];
  platform: string;
  apiPort?: number;
  apiSecret?: string;
  isHosting?: boolean;
  hostingMode?: 'easy' | 'advanced';
  tunnelUrl?: string;
}

export class DeviceService {
  private currentDeviceId: string | null = null;
  private currentUserId: string | null = null;
  private hostingChangeListeners: ((isHosting: boolean) => void)[] = [];
  
  constructor() {
    this.restoreDeviceId();
  }
  
  private async restoreDeviceId(): Promise<void> {
    try {
      if (window.electronAPI) {
        const savedDeviceId = await window.electronAPI.getStoreValue('deviceId');
        if (savedDeviceId) {
          this.currentDeviceId = savedDeviceId;
          console.log('🔄 Restored device ID:', savedDeviceId);
        }
      } else {
        // Web client - generate or restore from localStorage
        let deviceId = localStorage.getItem('pantheon-device-id');
        if (!deviceId) {
          deviceId = 'web_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
          localStorage.setItem('pantheon-device-id', deviceId);
        }
        this.currentDeviceId = deviceId;
      }
    } catch (error) {
      console.warn('Failed to restore device ID:', error);
      // Generate fallback device ID
      this.currentDeviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
  }

  async initialize(userId: string): Promise<void> {
    this.currentUserId = userId;
    console.log('✅ Device service initialized for user:', userId);
  }

  getDeviceId(): string {
    if (!this.currentDeviceId) {
      // Generate a new device ID if none exists
      this.currentDeviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      
      if (window.electronAPI) {
        window.electronAPI.setStoreValue('deviceId', this.currentDeviceId);
      } else {
        localStorage.setItem('pantheon-device-id', this.currentDeviceId);
      }
    }
    return this.currentDeviceId;
  }

  getCurrentUserId(): string | null {
    return this.currentUserId;
  }

  // Hosting status management (for local state only)
  onHostingStatusChange(listener: (isHosting: boolean) => void): () => void {
    this.hostingChangeListeners.push(listener);
    return () => {
      const index = this.hostingChangeListeners.indexOf(listener);
      if (index > -1) {
        this.hostingChangeListeners.splice(index, 1);
      }
    };
  }

  private notifyHostingStatusChange(isHosting: boolean): void {
    this.hostingChangeListeners.forEach(listener => {
      try {
        listener(isHosting);
      } catch (error) {
        console.error('Error in hosting status listener:', error);
      }
    });
  }

  // For compatibility - these now do nothing since we use P2P discovery
  async registerDevice(): Promise<void> {
    console.log('📍 Device registration is now handled by P2P discovery');
  }

  async updateHostingStatus(isHosting: boolean): Promise<void> {
    console.log('📍 Hosting status is now managed by P2P service:', isHosting);
    this.notifyHostingStatusChange(isHosting);
  }

  async unregisterDevice(): Promise<void> {
    console.log('📍 Device unregistration is now handled by P2P service');
  }

  // Legacy method stubs for compatibility
  async getAllDevices(): Promise<Device[]> {
    console.warn('getAllDevices() is deprecated - use P2P peer discovery instead');
    return [];
  }

  async getDevicesForUser(): Promise<Device[]> {
    console.warn('getDevicesForUser() is deprecated - use P2P peer discovery instead');
    return [];
  }
}

// Export singleton instance
export const deviceService = new DeviceService();
export default deviceService;