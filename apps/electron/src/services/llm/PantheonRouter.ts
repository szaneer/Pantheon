import axios from 'axios';
import { ChatMessage, ChatResponse, PantheonRequest } from '../../types/api/chat';

interface Device {
  id: string;
  name: string;
  endpoint: string;
  apiSecret?: string;
  isOnline: boolean;
  models: string[];
}

export class PantheonRouter {
  private currentUserId: string | null = null;

  setCurrentUserId(userId: string) {
    this.currentUserId = userId;
  }

  async routeToRemoteDevice(deviceId: string, modelId: string, messages: ChatMessage[]): Promise<ChatResponse> {
    if (!this.currentUserId) {
      throw new Error('User not authenticated');
    }

    const device = await this.getDevice(deviceId);
    
    if (!device.isOnline) {
      throw new Error(`Device ${device.name} is offline`);
    }

    if (!device.apiSecret) {
      throw new Error(`Device ${device.name} does not have an API secret configured`);
    }

    await this.runDiagnostics(device);
    
    const client = this.createDeviceClient(device);
    return await client.routeChat(modelId, messages);
  }

  private async getDevice(deviceId: string): Promise<Device> {
    const { deviceService } = await import('../deviceService');
    
    const devices = await deviceService.getDevicesForUser(this.currentUserId!);
    const device = devices.find(d => d.id === deviceId);
    
    if (!device) {
      throw new Error(`Device ${deviceId} not found in registry`);
    }

    return device;
  }

  private async runDiagnostics(device: Device): Promise<void> {
    try {
      // Test health endpoint
      try {
        await axios.get(`${device.endpoint}/health`, {
          headers: { 'x-device-secret': device.apiSecret! },
          timeout: 5000
        });
      } catch (healthError: any) {
        console.warn(`Health check failed for ${device.name}:`, healthError.message);
      }
      
      // Test basic connectivity
      try {
        const basicResponse = await axios.get(`${device.endpoint}/health`, {
          timeout: 5000,
          validateStatus: () => true
        });
        
        if (basicResponse.status === 401) {
          console.log(`Authentication required for ${device.name}`);
        }
      } catch (basicError: any) {
        if (basicError.code === 'ECONNREFUSED') {
          throw new Error(`Cannot connect to ${device.name} at ${device.endpoint}. The device API server is not running.`);
        } else if (basicError.code === 'ENOTFOUND') {
          throw new Error(`Cannot resolve hostname for ${device.name} at ${device.endpoint}. Check network configuration.`);
        }
        throw basicError;
      }
    } catch (error: any) {
      console.error(`Diagnostic check failed for ${device.name}:`, error.message);
      throw error;
    }
  }

  private createDeviceClient(device: Device) {
    return {
      routeChat: async (modelId: string, messages: ChatMessage[]): Promise<ChatResponse> => {
        try {
          const pantheonRequest: PantheonRequest = {
            type: 'PANTHEON_CHAT_REQUEST',
            target: {
              deviceId: device.id,
              deviceName: device.name,
              endpoint: device.endpoint
            },
            payload: {
              modelId,
              messages,
              userId: this.currentUserId,
              timestamp: Date.now()
            },
            security: {
              apiSecret: device.apiSecret!,
              encrypted: true,
              authenticated: true
            }
          };
          
          const response = await axios.post(`${device.endpoint}/chat`, pantheonRequest.payload, {
            headers: { 
              'x-device-secret': device.apiSecret!,
              'x-pantheon-routing': 'true',
              'x-pantheon-user': this.currentUserId!,
              'x-pantheon-timestamp': pantheonRequest.payload.timestamp.toString()
            },
            timeout: 30000,
            validateStatus: (status) => status < 500
          });
          
          if (response.status === 404) {
            throw new Error(`Chat endpoint not found on ${device.name}. The device API server may not be running or configured correctly.`);
          }
          
          if (response.data?.success) {
            return {
              message: response.data.data.message,
              model: `${device.name}:${modelId}`,
              usage: response.data.data.usage,
              pantheonRouted: true,
              deviceId: device.id,
              deviceName: device.name
            };
          } else {
            throw new Error(response.data?.error || `Remote chat request failed with status ${response.status}`);
          }
        } catch (error: any) {
          if (error.code === 'ECONNREFUSED') {
            throw new Error(`Cannot reach device ${device.name} - device may be offline or network unreachable`);
          } else if (error.response?.status === 401) {
            throw new Error(`Authentication failed with device ${device.name} - invalid API secret`);
          } else if (error.code === 'ENOTFOUND') {
            throw new Error(`Device ${device.name} hostname not found - check network configuration`);
          } else {
            throw new Error(`Communication with ${device.name} failed - ${error.message}`);
          }
        }
      }
    };
  }
}