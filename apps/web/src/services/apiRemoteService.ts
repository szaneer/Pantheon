import { LLMModel } from '../types/api/models';
import { tunnelAuthService } from './tunnelAuthService';
import { auth } from '../config/firebase';

export interface RemoteDevice {
  id: string;
  name: string;
  endpoint: string;
  tunnelUrl?: string;
  models: string[];
  isOnline: boolean;
  platform: string;
}

export interface ApiKeyAuth {
  apiKey: string;
  deviceId: string;
}

export class ApiRemoteService {
  private apiKey: string | null = null;
  private devices: Map<string, RemoteDevice> = new Map();

  constructor() {
    this.loadApiKey();
  }

  // Set API key for remote access
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
    localStorage.setItem('pantheon_api_key', apiKey);
  }

  // Load API key from localStorage
  private loadApiKey(): void {
    const saved = localStorage.getItem('pantheon_api_key');
    if (saved) {
      this.apiKey = saved;
    }
  }

  // Get current API key
  getApiKey(): string | null {
    return this.apiKey;
  }

  // Clear API key
  clearApiKey(): void {
    this.apiKey = null;
    localStorage.removeItem('pantheon_api_key');
    this.devices.clear();
  }

  // Test API key against a device endpoint
  async testApiKey(endpoint: string, apiKey: string): Promise<{success: boolean, error?: string, needsAuth?: boolean}> {
    try {
      const deviceId = tunnelAuthService.getDeviceIdFromEndpoint(endpoint);
      const user = auth.currentUser;
      
      // Try with stored authentication first
      const response = await tunnelAuthService.authenticatedFetch(`${endpoint}/health`, {
        method: 'GET',
        headers: {
          'x-device-secret': apiKey,
          'Content-Type': 'application/json',
          'User-Agent': 'Pantheon-Web-Client/1.0'
        }
      }, user?.uid, deviceId);

      if (response.status === 511) {
        // Network Authentication Required - common for loca.lt tunnels
        return {
          success: false,
          error: 'Tunnel requires browser authentication. Please visit the tunnel URL in a new tab first, then try again.',
          needsAuth: true
        };
      }

      if (response.status === 401) {
        return {
          success: false,
          error: 'Invalid API key. Please check your API key and try again.'
        };
      }

      if (response.ok) {
        return { success: true };
      }

      return {
        success: false,
        error: `Unexpected response: ${response.status} ${response.statusText}`
      };

    } catch (error) {
      console.error('API key test failed:', error);
      
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        return {
          success: false,
          error: 'Cannot reach the tunnel URL. Please check the URL and ensure the hosting device is online.'
        };
      }

      return {
        success: false,
        error: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Add a remote device manually
  async addDevice(endpoint: string, apiKey: string, deviceName?: string): Promise<RemoteDevice> {
    // Test the connection first
    const testResult = await this.testApiKey(endpoint, apiKey);
    if (!testResult.success) {
      if (testResult.needsAuth) {
        throw new Error(`${testResult.error}\n\nTo fix this:\n1. Open ${endpoint} in a new browser tab\n2. Complete any authentication prompts\n3. Try connecting again`);
      }
      throw new Error(testResult.error || 'Invalid API key or unreachable endpoint');
    }

    // Get device models
    const models = await this.getDeviceModels(endpoint, apiKey);
    
    const device: RemoteDevice = {
      id: this.generateDeviceId(endpoint),
      name: deviceName || `Remote Device (${new URL(endpoint).hostname})`,
      endpoint,
      models: models.map(m => m.name),
      isOnline: true,
      platform: 'remote'
    };

    this.devices.set(device.id, device);
    this.setApiKey(apiKey); // Save the working API key
    
    return device;
  }

  // Generate device ID from endpoint
  private generateDeviceId(endpoint: string): string {
    const url = new URL(endpoint);
    return `remote_${url.hostname}_${url.port || '80'}`;
  }

  // Get models from a specific device
  async getDeviceModels(endpoint: string, apiKey: string): Promise<LLMModel[]> {
    try {
      const deviceId = tunnelAuthService.getDeviceIdFromEndpoint(endpoint);
      const user = auth.currentUser;
      
      const response = await tunnelAuthService.authenticatedFetch(`${endpoint}/models`, {
        method: 'GET',
        headers: {
          'x-device-secret': apiKey,
          'Content-Type': 'application/json'
        }
      }, user?.uid, deviceId);

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const data = await response.json();
      const deviceId = this.generateDeviceId(endpoint);
      
      return data.models.map((model: any) => ({
        id: `${deviceId}_${model.id}`,
        name: model.id,
        displayName: model.name || model.id,
        provider: model.provider || 'Remote Ollama',
        deviceId,
        deviceName: this.devices.get(deviceId)?.name || 'Remote Device',
        endpoint,
        isRemote: true,
        apiSecret: apiKey
      }));
    } catch (error) {
      console.error('Failed to get device models:', error);
      throw new Error(`Failed to fetch models: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get all models from all connected devices
  async getAllModels(): Promise<LLMModel[]> {
    if (!this.apiKey) {
      return [];
    }

    const allModels: LLMModel[] = [];
    
    for (const device of this.devices.values()) {
      try {
        const models = await this.getDeviceModels(device.endpoint, this.apiKey);
        allModels.push(...models);
      } catch (error) {
        console.error(`Failed to get models from device ${device.name}:`, error);
        // Mark device as offline
        device.isOnline = false;
      }
    }

    return allModels;
  }

  // Send chat request to remote device
  async sendChatRequest(endpoint: string, apiKey: string, modelId: string, messages: any[]): Promise<Response> {
    const deviceId = tunnelAuthService.getDeviceIdFromEndpoint(endpoint);
    const user = auth.currentUser;
    
    // Extract the actual model name from the model ID
    // Format: ${generateDeviceId(endpoint)}_${actualModelId}
    const expectedPrefix = `${this.generateDeviceId(endpoint)}_`;
    const actualModelId = modelId.startsWith(expectedPrefix) 
      ? modelId.substring(expectedPrefix.length)
      : modelId;
    
    const response = await tunnelAuthService.authenticatedFetch(`${endpoint}/chat`, {
      method: 'POST',
      headers: {
        'x-device-secret': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: actualModelId,
        messages,
        stream: true
      })
    }, user?.uid, deviceId);

    if (!response.ok) {
      throw new Error(`Chat request failed: ${response.statusText}`);
    }

    return response;
  }

  // Get all connected devices
  getDevices(): RemoteDevice[] {
    return Array.from(this.devices.values());
  }

  // Remove a device
  removeDevice(deviceId: string): void {
    this.devices.delete(deviceId);
  }

  // Check if any devices are connected
  hasDevices(): boolean {
    return this.devices.size > 0;
  }

  // Discover devices using Firebase (if user is authenticated)
  async discoverDevicesFromFirebase(userId: string): Promise<RemoteDevice[]> {
    // This would integrate with Firebase to discover devices
    // For now, return empty array as this requires Firebase setup
    console.log('Firebase device discovery not implemented in simplified version');
    return [];
  }

  // Auto-connect to devices from a tunnel URL
  async connectToTunnelUrl(tunnelUrl: string, apiKey: string, deviceName?: string): Promise<RemoteDevice> {
    try {
      // Clean up URL (remove trailing slash, ensure HTTPS for tunnel URLs)
      let endpoint = tunnelUrl.trim();
      if (endpoint.endsWith('/')) {
        endpoint = endpoint.slice(0, -1);
      }
      
      // Ensure HTTPS for tunnel URLs (like loca.lt)
      if (endpoint.includes('loca.lt') && !endpoint.startsWith('https://')) {
        endpoint = endpoint.replace('http://', 'https://');
      }

      return await this.addDevice(endpoint, apiKey, deviceName);
    } catch (error) {
      console.error('Failed to connect to tunnel URL:', error);
      throw new Error(`Failed to connect to tunnel: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export singleton instance
export const apiRemoteService = new ApiRemoteService();