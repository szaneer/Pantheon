import { LLMProvider } from '../../providers/LLMProvider';
import { RemoteLLMProvider } from '../../providers/RemoteProvider';
import { ModelRegistry } from './ModelRegistry';
import { LLMModel } from '../../types/api/models';
import { ChatMessage, ChatResponse } from '../../types/api/chat';

export class LLMService {
  private modelRegistry: ModelRegistry;

  constructor() {
    this.modelRegistry = new ModelRegistry();
    
    // Web version doesn't support local Ollama models
    // Only remote models via P2P are supported
  }

  setCurrentUserId(userId: string) {
    this.modelRegistry.setCurrentUserId(userId);
  }

  addProvider(id: string, provider: LLMProvider) {
    this.modelRegistry.addProvider(id, provider);
  }

  async getAllModels(): Promise<LLMModel[]> {
    return await this.modelRegistry.getAllModels();
  }

  async chat(modelId: string, messages: ChatMessage[]): Promise<ChatResponse> {
    // Try direct local access first
    const directResponse = await this.tryDirectLocalModel(modelId, messages);
    if (directResponse) {
      return directResponse;
    }
    
    // Get model from registry
    const targetModel = await this.modelRegistry.findModel(modelId);
    
    if (!targetModel) {
      throw new Error(`Model ${modelId} not found in registry or local providers`);
    }
    
    // Only support local models - remote models require P2P client service
    if (targetModel.isRemote) {
      throw new Error('Remote models not supported in this version - use P2P client service');
    }
    
    return await this.chatWithLocalModel(targetModel, messages);
  }

  private async tryDirectLocalModel(modelId: string, messages: ChatMessage[]): Promise<ChatResponse | null> {
    const result = await this.modelRegistry.findLocalModel(modelId);
    
    if (result) {
      const response = await result.provider.chat(result.model.id, messages);
      
      return {
        ...response,
        model: `Local:${result.model.name}`,
        pantheonRouted: false,
        deviceId: 'local',
        deviceName: 'Local Device'
      };
    }
    
    return null;
  }

  private async chatWithLocalModel(targetModel: LLMModel, messages: ChatMessage[]): Promise<ChatResponse> {
    const result = await this.modelRegistry.findLocalModel(targetModel.id);
    
    if (!result) {
      throw new Error(`Model ${targetModel.id} not found in any available local provider`);
    }

    const response = await result.provider.chat(result.model.id, messages);
    
    return {
      ...response,
      model: `Local:${targetModel.name}`,
      pantheonRouted: false,
      deviceId: 'local',
      deviceName: 'Local Device'
    };
  }

  async addRemoteProvider(endpoint: string): Promise<void> {
    const provider = new RemoteLLMProvider(endpoint);
    if (await provider.isAvailable()) {
      this.addProvider(`remote-${Date.now()}`, provider);
    } else {
      throw new Error('Remote provider is not available');
    }
  }
}