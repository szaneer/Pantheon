import { RemoteProvider } from '../providers/WebRemoteProvider';
import { LLMModel } from '../types/api/models';
import { Device } from './webDeviceService';
import p2pClientServiceV2, { PeerInfo } from './p2pClientServiceV2';

export class WebLLMService {
  private remoteProvider: RemoteProvider;

  constructor() {
    this.remoteProvider = new RemoteProvider();
  }

  async getModels(devices: Device[], userId?: string): Promise<LLMModel[]> {
    console.log('🔍 Getting models from remote devices and P2P hosts...');
    
    const allModels: LLMModel[] = [];
    
    try {
    
    // Get models from direct Firebase devices (legacy)
    for (const device of devices) {
      if (!device.isOnline || !device.models || device.models.length === 0) {
        continue;
      }

      for (const modelName of device.models) {
        const model: LLMModel = {
          id: `firebase_${device.id}_${modelName}`,
          name: modelName,
          displayName: modelName,
          provider: 'Remote (Legacy)',
          deviceId: device.id,
          deviceName: device.name,
          endpoint: device.endpoint,
          isRemote: true,
          apiSecret: device.apiSecret
        };
        allModels.push(model);
      }
    }

    // Get models from P2P hosted devices
    try {
      const p2pStatus = p2pClientServiceV2.getStatus();
      console.log('🔍 P2P Service Status:', p2pStatus);
      
      if (p2pStatus.connected) {
        console.log('🌐 Fetching P2P hosted devices...');
        
        // Discover peers and get models
        await p2pClientServiceV2.discoverPeers();
        const allPeerModels = p2pClientServiceV2.getAllAvailableModels();
        console.log('📋 Found P2P peer models:', allPeerModels);
        
        // Convert peer models to LLM models
        for (const [peerId, models] of Object.entries(allPeerModels)) {
          console.log(`🤖 Processing models from peer ${peerId}:`, models);
          
          for (const modelInfo of models) {
            try {
              const modelId = `p2p_${peerId}_${modelInfo.name}`;
              
              // Check if this model already exists
              const existingModel = allModels.find(m => m.id === modelId);
              if (existingModel) {
                console.warn(`⚠️ Duplicate model detected: ${modelId} - skipping`);
                continue;
              }
              
              const model: LLMModel = {
                id: modelId,
                name: modelInfo.name,
                displayName: modelInfo.displayName || modelInfo.name,
                provider: modelInfo.provider || 'Unknown',
                deviceId: peerId,
                deviceName: `P2P Device (${peerId.substring(0, 8)}...)`,
                endpoint: 'p2p://' + peerId,
                isRemote: true,
                isP2P: true,
                peerId: peerId
              };
              allModels.push(model);
              console.log('✅ Added P2P model:', model.id);
            } catch (error) {
              console.error(`❌ Failed to process model from peer ${peerId}:`, error);
            }
          }
        }
        
        const totalP2PModels = allModels.filter(m => m.isP2P).length;
        const totalP2PDevices = Object.keys(allPeerModels).length;
        console.log(`🌐 Found ${totalP2PDevices} P2P hosts with ${totalP2PModels} total models`);
      } else {
        console.log('🔌 P2P client not connected, skipping P2P device discovery');
        console.log('💡 P2P Status Details:', {
          status: p2pStatus.status,
          connected: p2pStatus.connected,
          error: p2pStatus.error,
          serverUrl: p2pStatus.serverUrl
        });
      }
    } catch (error) {
      console.error('❌ Failed to fetch P2P devices:', error);
    }

    // Deduplicate models by ID
    const uniqueModels = allModels.filter((model, index, self) => 
      index === self.findIndex(m => m.id === model.id)
    );

    console.log('🤖 All available models:', uniqueModels.map(m => ({
      id: m.id,
      name: m.name,
      deviceName: m.deviceName,
      provider: m.provider,
      isP2P: m.isP2P || false
    })));

    if (uniqueModels.length !== allModels.length) {
      console.warn(`⚠️ Removed ${allModels.length - uniqueModels.length} duplicate models`);
    }

    return uniqueModels;
    
    } catch (error) {
      console.error('❌ Error in getModels:', error);
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack');
      throw error;
    }
  }

  async generateResponse(
    model: LLMModel,
    messages: Array<{ role: string; content: string }>,
    onToken?: (token: string) => void,
    onComplete?: () => void
  ): Promise<void> {
    if (!model.isRemote) {
      throw new Error('Web version only supports remote models');
    }

    console.log('🚀 Generating response with model:', `${model.name} (${model.deviceName}) [${model.provider}]`);
    
    // Handle P2P models differently
    if (model.isP2P && model.peerId) {
      return this.generateP2PResponse(model, messages, onToken, onComplete);
    }
    
    // Handle legacy Firebase remote models
    return this.remoteProvider.generateResponse(
      model,
      messages,
      onToken,
      onComplete
    );
  }

  private async generateP2PResponse(
    model: LLMModel,
    messages: Array<{ role: string; content: string }>,
    onToken?: (token: string) => void,
    onComplete?: () => void
  ): Promise<void> {
    if (!model.peerId) {
      throw new Error('P2P model missing peer ID');
    }

    if (!p2pClientServiceV2.getStatus().connected) {
      throw new Error('Not connected to P2P server');
    }

    try {
      // Check if we're connected to this peer, if not, connect
      let connectedPeers = p2pClientServiceV2.getConnectedPeers();
      if (!connectedPeers.includes(model.peerId)) {
        console.log('🔗 Not connected to peer, establishing P2P connection...');
        
        // Add random delay to avoid simultaneous connection attempts
        const delay = Math.floor(Math.random() * 1000) + 500; // 500-1500ms random delay
        console.log(`⏱️ Waiting ${delay}ms before connecting to avoid collision...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        await p2pClientServiceV2.connectToPeer(model.peerId);
        // Wait a bit for connection to stabilize
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify connection was established
        connectedPeers = p2pClientServiceV2.getConnectedPeers();
        if (!connectedPeers.includes(model.peerId)) {
          throw new Error(`Failed to establish connection with peer ${model.peerId}`);
        }
      }
      
      console.log('🌐 Sending P2P chat request to peer:', model.peerId);
      
      // Extract the actual model name from the model ID
      // Format: p2p_${peerId}_${modelName}
      let actualModelName = model.name;
      if (model.id.startsWith('p2p_')) {
        const parts = model.id.split('_');
        actualModelName = parts.slice(2).join('_'); // Everything after "p2p_peerId_"
      }
      
      // Try to send the request, with one retry if connection drops
      let response;
      try {
        response = await p2pClientServiceV2.sendChatRequest(model.peerId, {
          model: actualModelName,
          messages: messages,
          temperature: 0.7,
          max_tokens: 2048
        });
      } catch (error: any) {
        if (error.message?.includes('Not connected')) {
          console.log('⚠️ Connection lost, attempting to reconnect...');
          
          // Try to reconnect once
          await new Promise(resolve => setTimeout(resolve, 1000));
          await p2pClientServiceV2.connectToPeer(model.peerId);
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Retry the request
          response = await p2pClientServiceV2.sendChatRequest(model.peerId, {
            model: actualModelName,
            messages: messages,
            temperature: 0.7,
            max_tokens: 2048
          });
        } else {
          throw error;
        }
      }

      // Stream the response content
      if (onToken && response.choices?.[0]?.message?.content) {
        const content = response.choices[0].message.content;
        
        // Simulate streaming by splitting into words
        const words = content.split(' ');
        for (let i = 0; i < words.length; i++) {
          const word = i === 0 ? words[i] : ' ' + words[i];
          onToken(word);
          // Small delay to simulate real streaming
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      if (onComplete) {
        onComplete();
      }

    } catch (error) {
      console.error('❌ P2P chat request failed:', error);
      throw error;
    }
  }

  async testModelConnection(model: LLMModel): Promise<boolean> {
    if (!model.isRemote) {
      return false;
    }

    try {
      console.log('🔍 Testing connection to model:', `${model.name} (${model.deviceName}) [${model.provider}]`);
      
      // Handle P2P models
      if (model.isP2P && model.peerId) {
        return p2pClientServiceV2.getStatus().connected && 
               p2pClientServiceV2.getCachedPeers().some(peer => peer.peer_id === model.peerId);
      }
      
      // Handle legacy Firebase remote models
      return await this.remoteProvider.testConnection(model);
    } catch (error) {
      console.error('❌ Failed to test model connection:', error);
      return false;
    }
  }

}

export const webLLMService = new WebLLMService();