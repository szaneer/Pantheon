import { LLMModel } from '../../types/api/models';
import { LLMProvider } from '../../providers/LLMProvider';

export class ModelRegistry {
  private providers: Map<string, LLMProvider> = new Map();
  private currentUserId: string | null = null;

  setCurrentUserId(userId: string) {
    this.currentUserId = userId;
  }

  addProvider(id: string, provider: LLMProvider) {
    this.providers.set(id, provider);
  }

  getProvider(id: string): LLMProvider | undefined {
    return this.providers.get(id);
  }

  getAllProviders(): Map<string, LLMProvider> {
    return this.providers;
  }

  async getLocalModels(): Promise<LLMModel[]> {
    const allModels: LLMModel[] = [];
    
    for (const [id, provider] of this.providers) {
      try {
        const isAvailable = await provider.isAvailable();
        
        if (isAvailable) {
          const models = await provider.getModels();
          allModels.push(...models);
        }
      } catch (error) {
        console.error(`Failed to get models from provider ${id}:`, error);
      }
    }

    return allModels;
  }

  async getRemoteModels(): Promise<LLMModel[]> {
    try {
      const { deviceService } = await import('../deviceService');
      
      if (!this.currentUserId) {
        return [];
      }

      const devices = await deviceService.getDevicesForUser(this.currentUserId);
      
      let currentDeviceId: string | null = null;
      if (window.electronAPI) {
        currentDeviceId = await window.electronAPI.getDeviceId();
      }
      
      const remoteModels: LLMModel[] = [];

      for (const device of devices) {
        if (device.id === currentDeviceId) {
          continue;
        }
        
        if (device.models && device.models.length > 0) {
          for (const modelName of device.models) {
            remoteModels.push({
              id: `${device.id}|${modelName}`,
              name: modelName,
              provider: 'Remote Device',
              deviceId: device.id,
              deviceName: device.name,
              endpoint: device.endpoint,
              isRemote: true
            });
          }
        }
      }

      // Get P2P models if available
      try {
        const p2pModels = await this.getP2PModels();
        remoteModels.push(...p2pModels);
      } catch (error) {
        console.error('Error getting P2P models:', error);
      }

      return remoteModels;
    } catch (error) {
      console.error('Error getting remote device models:', error);
      return [];
    }
  }

  async getP2PModels(): Promise<LLMModel[]> {
    try {
      // Check if we're in the Electron renderer process
      if (!window.electronAPI) {
        return [];
      }

      // Get P2P status and models from the main process
      const p2pStatus = await window.electronAPI.p2pGetStatus();
      if (!p2pStatus.connected) {
        return [];
      }

      const p2pPeers = await window.electronAPI.p2pGetPeers();
      const p2pModels: LLMModel[] = [];

      for (const peer of p2pPeers) {
        if (peer.models && peer.models.length > 0) {
          for (const modelInfo of peer.models) {
            p2pModels.push({
              id: `p2p:${peer.peer_id}:${modelInfo.name}`,
              name: modelInfo.name,
              provider: 'P2P Ollama',
              deviceId: peer.peer_id,
              deviceName: `P2P Device (${peer.peer_id.substring(0, 8)}...)`,
              endpoint: `p2p://${peer.peer_id}`,
              isRemote: true,
              isP2P: true,
              peerId: peer.peer_id
            });
          }
        }
      }

      return p2pModels;
    } catch (error) {
      console.error('Error getting P2P models:', error);
      return [];
    }
  }

  async getAllModels(): Promise<LLMModel[]> {
    const [localModels, remoteModels] = await Promise.all([
      this.getLocalModels(),
      this.getRemoteModels()
    ]);

    return [...localModels, ...remoteModels];
  }

  async findModel(modelId: string): Promise<LLMModel | null> {
    const allModels = await this.getAllModels();
    return allModels.find(m => m.id === modelId) || null;
  }

  async findLocalModel(modelId: string): Promise<{ model: LLMModel; provider: LLMProvider } | null> {
    for (const [id, provider] of this.providers) {
      try {
        const models = await provider.getModels();
        const model = models.find(m => m.id === modelId || m.name === modelId);
        
        if (model) {
          return { model, provider };
        }
      } catch (error) {
        console.error(`Failed to search in provider ${id}:`, error);
      }
    }
    
    return null;
  }
}